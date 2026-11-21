import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  runWithOrganizationContext,
  type Ed25519PrivateJwk,
  type InternalPrincipal,
  type OrganizationContext,
} from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { AUTOMATION_SERVICE, AutomationServiceClient } from './automation-service.client.js';

const context: OrganizationContext = {
  organizationId: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01',
  actor: { type: 'user', id: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e02' },
  role: 'owner',
  scopes: ['automation:recipient:unverified'],
};
const recipient = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e03';
const scope = `automation:recipient:${recipient}`;
const creation = {
  trigger: { type: 'created' },
  action: { type: 'notify', userId: recipient },
} as const;
const rule = {
  ...creation,
  ruleId: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e04',
  createdAt: '2026-11-20T08:00:00Z',
  enabled: true,
  version: 1,
};
const candidate = {
  executionId: '019a701b-2b3c-7d4e-8f5a-6b7c8d9e0f12',
  ruleId: rule.ruleId,
  taskKey: 'CAD-482',
  action: creation.action,
  executedAt: '2026-11-20T08:05:00Z',
};

describe('AutomationServiceClient', () => {
  let signer: InternalTokenSigner;
  let verifier: InternalTokenVerifier;
  let requests: { request: Request; principal: InternalPrincipal }[];
  let answer: Response;
  let client: AutomationServiceClient;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: AUTOMATION_SERVICE,
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
  });

  beforeEach(() => {
    requests = [];
    answer = new Response(null, { status: 204 });
    client = new AutomationServiceClient(
      new InternalHttpClient({
        service: AUTOMATION_SERVICE,
        baseUrl: 'http://automation-service.test',
        signer,
        fetch: async (input, init) => {
          const request = new Request(input, init);
          const token = request.headers.get('Authorization')?.replace(/^Bearer /u, '') ?? '';
          requests.push({ request, principal: await verifier.verify(token) });
          return answer.clone();
        },
      }),
    );
  });

  it('uses the generated create route, signing the verified proof for the same actor and tenant', async () => {
    answer = Response.json(rule, {
      status: 201,
      headers: { ETag: '"1"', Location: `/internal/v1/automations/${rule.ruleId}` },
    });
    await expect(
      runWithOrganizationContext(context, () =>
        client.createRule(creation, {
          claims: { actor: context.actor, organizationId: context.organizationId, scopes: [scope] },
          headers: { 'Idempotency-Key': 'repeatable-creation' },
        }),
      ),
    ).resolves.toEqual(rule);
    expect(requests).toHaveLength(1);
    const first = requests[0];
    expect(first?.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      audience: AUTOMATION_SERVICE,
      organizationId: context.organizationId,
      actor: context.actor,
      scopes: [scope],
    });
    expect(first?.request.method).toBe('POST');
    expect(first?.request.url).toBe('http://automation-service.test/internal/v1/automations');
    expect(first?.request.headers.get('Idempotency-Key')).toBe('repeatable-creation');
    expect(await first?.request.json()).toEqual(creation);
  });

  it('rejects mismatched rule receipts and preserves strong update and delete headers', async () => {
    answer = Response.json(
      { ...rule, enabled: false, version: 2 },
      {
        headers: { ETag: '"8"' },
      },
    );
    await expect(
      runWithOrganizationContext(context, () =>
        client.updateRule(rule.ruleId, { enabled: false }, '"1"'),
      ),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed', details: { service: AUTOMATION_SERVICE } },
    });
    expect(requests[0]?.request.headers.get('If-Match')).toBe('"1"');

    answer = new Response(null, { status: 204 });
    await runWithOrganizationContext(context, () => client.deleteRule(rule.ruleId, '"2"'));
    expect(requests[1]?.request.method).toBe('DELETE');
    expect(requests[1]?.request.headers.get('If-Match')).toBe('"2"');
  });

  it('does not refresh an uncertain create using an earlier Organization proof', async () => {
    answer = Response.json(
      { type: 'about:blank', title: 'Unavailable', status: 503, code: 'automation.unavailable' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () =>
        client.createRule(creation, { headers: { 'Idempotency-Key': 'repeatable-creation' } }),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.unavailable' } });
    expect(requests).toHaveLength(1);
  });

  it.each([
    { items: [], nextCursor: 'next' },
    { items: [candidate, candidate], nextCursor: null },
    { items: [candidate], nextCursor: 'previous' },
  ])('rejects a candidate page that cannot advance the bounded scan', async (page) => {
    answer = Response.json(page);
    await expect(
      runWithOrganizationContext(context, () =>
        client.listRunCandidates({ cursor: 'previous', limit: 1 }),
      ),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed', details: { service: AUTOMATION_SERVICE } },
    });
  });

  it('keeps task checks inside the caller signal and returns a valid candidate page', async () => {
    answer = Response.json({ items: [candidate], nextCursor: null });
    const abort = new AbortController();
    const observe = vi.fn();
    abort.signal.addEventListener('abort', observe);
    await expect(
      runWithOrganizationContext(context, () =>
        client.listRunCandidates({ limit: 10 }, abort.signal),
      ),
    ).resolves.toEqual({ items: [candidate], nextCursor: null });
    expect(new URL(requests[0]?.request.url ?? '').searchParams.get('limit')).toBe('10');
    expect(observe).not.toHaveBeenCalled();
  });
});
