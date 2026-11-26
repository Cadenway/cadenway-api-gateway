import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  runWithOrganizationContext,
  type Ed25519PrivateJwk,
  type InternalPrincipal,
  type OrganizationContext,
} from '@cadenway/nest-common';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { responseExample } from '../../tests/support/public-contract.js';
import { generateSigningKeys } from '../../tests/support/test-environment.js';
import { INTEGRATION_SERVICE, IntegrationServiceClient } from './integration-service.client.js';

const bindingId = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const delivery = '806f0650-bdef-4474-a5cf-22b60c810f76';

describe('Integration service client', () => {
  it.each([
    [403, 'webhook.authentication-failed', 403, 'webhook.authentication-failed'],
    [403, 'auth.issuer-not-allowed', 403, 'auth.issuer-not-allowed'],
    [401, 'auth.token-invalid', 503, 'upstream.unauthorized'],
    [503, 'integration.unavailable', 503, 'integration.unavailable'],
  ])(
    'does not retry an Integration %i problem %s',
    async (status, code, expectedStatus, expectedCode) => {
      const keys = generateSigningKeys();
      const signer = await InternalTokenSigner.create({
        issuer: 'api-gateway',
        privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
      });
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(() =>
          Promise.resolve(
            Response.json(
              { type: 'about:blank', title: 'Refused', status, code },
              { status, headers: { 'Content-Type': 'application/problem+json' } },
            ),
          ),
        );
      const client = new IntegrationServiceClient(
        new InternalHttpClient({
          service: INTEGRATION_SERVICE,
          baseUrl: 'http://integration-service.test',
          signer,
          fetch,
          allowedUnavailableProblemCodes: ['integration.unavailable'],
        }),
      );
      await expect(
        client.receiveGitHubWebhook({
          bindingId,
          delivery,
          event: 'pull_request',
          signature: `sha256=${'a'.repeat(64)}`,
          body: Buffer.from('{}'),
        }),
      ).rejects.toMatchObject({ problem: { status: expectedStatus, code: expectedCode } });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it.each(['github', 'gitlab'] as const)(
    'relays %s bytes and provider headers once using a signed gateway identity',
    async (provider) => {
      const keys = generateSigningKeys();
      const signer = await InternalTokenSigner.create({
        issuer: 'api-gateway',
        privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
      });
      const verifier = await InternalTokenVerifier.create({
        audience: INTEGRATION_SERVICE,
        trustedIssuers: { 'api-gateway': [keys.publicJwk] },
      });
      const body = Buffer.from('\n{ "action": "opened", "subject": "équipe" }\r\n');
      const requests: {
        path: string | undefined;
        bytes: Buffer;
        principal: InternalPrincipal;
        headers: Record<string, string | string[] | undefined>;
      }[] = [];
      const server = createServer((request, response) => {
        void (async () => {
          const parts: Buffer[] = [];
          for await (const part of request) parts.push(Buffer.from(part as Uint8Array));
          const principal = await verifier.verify(
            (request.headers.authorization ?? '').replace(/^Bearer /u, ''),
          );
          requests.push({
            path: request.url,
            bytes: Buffer.concat(parts),
            principal,
            headers: request.headers,
          });
          response.writeHead(204, { 'Cache-Control': 'private, no-store' });
          response.end();
        })();
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const address = server.address();
        if (address === null || typeof address === 'string') throw new Error('No loopback port');
        const client = new IntegrationServiceClient(
          new InternalHttpClient({
            service: INTEGRATION_SERVICE,
            baseUrl: `http://127.0.0.1:${String(address.port)}`,
            signer,
          }),
        );
        const event = provider === 'github' ? 'pull_request' : 'Merge Request Hook';
        const signature = provider === 'github' ? `sha256=${'a'.repeat(64)}` : 'v1,c2ln';
        if (provider === 'github') {
          await client.receiveGitHubWebhook({ bindingId, delivery, event, signature, body });
        } else {
          await client.receiveGitLabWebhook({
            bindingId,
            delivery,
            event,
            signature,
            timestamp: '1760000000',
            body,
          });
        }
        expect(requests).toHaveLength(1);
        expect(requests[0]?.path).toBe(`/internal/v1/webhooks/${provider}?bindingId=${bindingId}`);
        expect(requests[0]?.bytes).toEqual(body);
        expect(requests[0]?.principal).toMatchObject({
          issuer: 'api-gateway',
          actor: { type: 'system', id: 'api-gateway' },
          organizationId: null,
        });
        expect(requests[0]?.headers['content-type']).toBe('application/json');
        expect(
          requests[0]?.headers[provider === 'github' ? 'x-github-delivery' : 'webhook-id'],
        ).toBe(delivery);
        expect(
          requests[0]?.headers[provider === 'github' ? 'x-hub-signature-256' : 'webhook-signature'],
        ).toBe(signature);
        if (provider === 'gitlab')
          expect(requests[0]?.headers['webhook-timestamp']).toBe('1760000000');
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      }
    },
  );
});

/** Camille in Atelier Nord, the context of a public Git link read. */
const CAMILLE_IN_ATELIER_NORD: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: ['tasks:read'],
};

/** The example page of the contract, the Git links of CAD-482. */
const GIT_LINKS = responseExample('get', '/v1/tasks/{taskKey}/git-links', 200) as {
  readonly items: readonly Record<string, unknown>[];
  readonly nextCursor: string | null;
};

/**
 * Builds a Git link reader over a fetch fake, with the verifier of its internal tokens.
 *
 * @param fetch - The fake transport.
 * @returns The client and the verifier.
 */
async function readerFor(fetch: typeof globalThis.fetch): Promise<{
  client: IntegrationServiceClient;
  verifier: InternalTokenVerifier;
}> {
  const keys = generateSigningKeys();
  const signer = await InternalTokenSigner.create({
    issuer: 'api-gateway',
    privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
  });
  const verifier = await InternalTokenVerifier.create({
    audience: INTEGRATION_SERVICE,
    trustedIssuers: { 'api-gateway': [keys.publicJwk] },
  });
  const client = new IntegrationServiceClient(
    new InternalHttpClient({
      service: INTEGRATION_SERVICE,
      baseUrl: 'http://integration-service.test',
      signer,
      fetch,
      allowedUnavailableProblemCodes: ['integration.unavailable'],
    }),
  );
  return { client, verifier };
}

/**
 * A JSON page with the private cache policy the internal contract requires.
 *
 * @param body - The page.
 * @param cacheControl - The cache policy.
 * @returns The answer.
 */
function pageAnswer(body: unknown, cacheControl = 'private, no-store'): Response {
  return Response.json(body, { headers: { 'Cache-Control': cacheControl } });
}

/**
 * The URL a fetch fake received.
 *
 * @param input - The first argument of the call.
 * @returns The URL as text.
 */
function urlOf(input: string | URL | Request | undefined): string | undefined {
  if (input === undefined || typeof input === 'string') return input;
  return input instanceof Request ? input.url : input.href;
}

/**
 * A problem answer of integration-service.
 *
 * @param status - Its status.
 * @param code - Its code.
 * @returns The answer.
 */
function problemAnswer(status: number, code: string): Response {
  return Response.json(
    { type: 'about:blank', title: 'Refused', status, code },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

describe('Integration service Git link read', () => {
  it('reads a page with the user and organization of the request, its query and signal', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => Promise.resolve(pageAnswer(GIT_LINKS)));
    const { client, verifier } = await readerFor(fetch);
    const { signal } = new AbortController();

    await expect(
      runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, () =>
        client.listTaskGitLinks('CAD-482', { cursor: 'b3BhcXVl', limit: 20 }, signal),
      ),
    ).resolves.toEqual(GIT_LINKS);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(urlOf(url)).toBe(
      'http://integration-service.test/internal/v1/tasks/CAD-482/git-links?cursor=b3BhcXVl&limit=20',
    );
    const authorization = new Headers(init?.headers).get('Authorization') ?? '';
    const principal: InternalPrincipal = await verifier.verify(
      authorization.replace('Bearer ', ''),
    );
    expect(principal).toMatchObject({
      issuer: 'api-gateway',
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
  });

  it('reads the first page with the contract default limit', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => Promise.resolve(pageAnswer({ items: [], nextCursor: null })));
    const { client } = await readerFor(fetch);

    await runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, () =>
      client.listTaskGitLinks('CAD-482', {}),
    );

    expect(urlOf(fetch.mock.calls[0]?.[0])).toBe(
      'http://integration-service.test/internal/v1/tasks/CAD-482/git-links?limit=50',
    );
  });

  it.each([
    {
      label: 'a link of another task',
      answer: () =>
        pageAnswer({ ...GIT_LINKS, items: [{ ...GIT_LINKS.items[0], taskKey: 'CAD-483' }] }),
    },
    {
      label: 'a page without the private cache policy',
      answer: () => pageAnswer(GIT_LINKS, 'no-store'),
    },
    {
      label: 'a page outside the internal contract',
      answer: () => pageAnswer({ items: [{ id: 'not-a-link' }] }),
    },
  ])('refuses $label as 503 upstream.failed', async ({ answer }) => {
    const { client } = await readerFor(
      vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(answer())),
    );

    await expect(
      runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, () =>
        client.listTaskGitLinks('CAD-482', {}),
      ),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed', details: { service: INTEGRATION_SERVICE } },
    });
  });

  it('answers integration.unavailable as 503 upstream.unavailable after its one retry', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => Promise.resolve(problemAnswer(503, 'integration.unavailable')));
    const { client } = await readerFor(fetch);

    await expect(
      runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, () =>
        client.listTaskGitLinks('CAD-482', {}),
      ),
    ).rejects.toMatchObject({
      problem: {
        status: 503,
        code: 'upstream.unavailable',
        details: { service: INTEGRATION_SERVICE },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('relays a refused cursor as 400 request.invalid', async () => {
    const { client } = await readerFor(
      vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(() => Promise.resolve(problemAnswer(400, 'request.invalid'))),
    );

    await expect(
      runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, () =>
        client.listTaskGitLinks('CAD-482', { cursor: 'b3RoZXI' }),
      ),
    ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
  });

  it('refuses a query outside the internal contract before any call', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const { client } = await readerFor(fetch);

    await expect(client.listTaskGitLinks('CAD-482', { limit: 0 })).rejects.toThrow(
      'The gateway built listTaskGitLinksInternal outside the internal contract.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
