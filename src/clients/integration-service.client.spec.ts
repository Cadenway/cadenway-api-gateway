import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  type Ed25519PrivateJwk,
  type InternalPrincipal,
} from '@cadenway/nest-common';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

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
