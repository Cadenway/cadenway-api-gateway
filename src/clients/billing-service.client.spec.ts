import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type {
  Ed25519PrivateJwk,
  InternalPrincipal,
  OrganizationContext,
} from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { BILLING_SERVICE, BillingServiceClient } from './billing-service.client.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: [],
};
const subscription = {
  plan: 'free',
  seats: { used: 3, limit: 5 },
  guestCount: 1,
  storage: { attachmentBytesUsed: 120_000_000, limitBytes: 2_000_000_000 },
};
const headers = { 'Cache-Control': 'private, no-store' };

describe('BillingServiceClient', () => {
  let signer: InternalTokenSigner;
  let verifier: InternalTokenVerifier;
  let answer: Response;
  let calls: { url: string; init?: RequestInit }[];
  let client: BillingServiceClient;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: BILLING_SERVICE,
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
  });

  beforeEach(() => {
    calls = [];
    answer = Response.json(subscription, { headers });
    client = new BillingServiceClient(
      new InternalHttpClient({
        service: BILLING_SERVICE,
        baseUrl: 'http://billing-service.test',
        signer,
        allowedUnavailableProblemCodes: ['billing.unavailable'],
        fetch: (input, init) => {
          calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
          return Promise.resolve(answer.clone());
        },
      }),
    );
  });

  it('forwards the current user and organization with a signed subscription read', async () => {
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).resolves.toEqual(subscription);
    expect(calls[0]?.url).toBe('http://billing-service.test/internal/v1/billing/subscription');
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toMatch(/^Bearer /u);
  });

  it('rejects malformed bodies and a missing private cache policy', async () => {
    answer = Response.json({ ...subscription, seats: { used: -1, limit: 5 } }, { headers });
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });

    answer = Response.json(subscription);
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('bounds decoded response bytes', async () => {
    answer = new Response('x'.repeat(16 * 1024 + 1), {
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    });
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('preserves the documented unavailable billing baseline', async () => {
    answer = Response.json(
      { type: 'about:blank', title: 'Unavailable', status: 503, code: 'billing.unavailable' },
      { status: 503, headers: { ...headers, 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'billing.unavailable' },
    });
  });

  it('relays exact Stripe bytes once with system claims even within a user context', async () => {
    answer = new Response(null, { status: 204, headers });
    const body = Buffer.from('\n{ "id": "evt_1", "description": "équipe" }\r\n');
    const signature = 't=1760000000,v1=0123456789abcdef';

    await runWithOrganizationContext(context, () =>
      client.receiveStripeWebhook({ body, signature }),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://billing-service.test/internal/v1/billing/webhooks/stripe');
    const requestHeaders = new Headers(calls[0]?.init?.headers);
    expect(requestHeaders.get('Stripe-Signature')).toBe(signature);
    expect(requestHeaders.get('Content-Type')).toBe('application/json');
    const sentBody = calls[0]?.init?.body;
    expect(sentBody).toBeInstanceOf(Blob);
    expect(Buffer.from(await (sentBody as Blob).arrayBuffer())).toEqual(body);
    const principal: InternalPrincipal = await verifier.verify(
      (requestHeaders.get('Authorization') ?? '').replace(/^Bearer /u, ''),
    );
    expect(principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'system', id: 'api-gateway' },
      organizationId: null,
    });
  });

  it.each([
    [400, 'billing.invalid-webhook-signature', 400, 'billing.invalid-webhook-signature'],
    [503, 'billing.unavailable', 503, 'billing.unavailable'],
  ])(
    'propagates the Billing problem %s without retrying',
    async (status, code, expectedStatus, expectedCode) => {
      answer = Response.json(
        { type: 'about:blank', title: 'Refused', status, code },
        { status, headers: { ...headers, 'Content-Type': 'application/problem+json' } },
      );
      await expect(
        client.receiveStripeWebhook({ body: Buffer.from('{}'), signature: 't=1,v1=abc' }),
      ).rejects.toMatchObject({ problem: { status: expectedStatus, code: expectedCode } });
      expect(calls).toHaveLength(1);
    },
  );

  it('rejects an acknowledged Stripe delivery without its private cache policy', async () => {
    answer = new Response(null, { status: 204 });
    await expect(
      client.receiveStripeWebhook({ body: Buffer.from('{}'), signature: 't=1,v1=abc' }),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(calls).toHaveLength(1);
  });

  it('cancels an unexpected successful response before the generated client reads it', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const response = new Response(body, { status: 200, headers });
    const read = vi.spyOn(response, 'text');
    const transport = {
      fetch: vi.fn().mockResolvedValue(response),
    } as unknown as InternalHttpClient;
    const stripe = new BillingServiceClient(transport);

    await expect(
      stripe.receiveStripeWebhook({ body: Buffer.from('{}'), signature: 't=1,v1=abc' }),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(read).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
