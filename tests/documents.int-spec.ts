import { Writable } from 'node:stream';

import { InternalTokenVerifier, type InternalPrincipal } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import { ATELIER_NORD_ID, CAMILLE } from './support/fake-identity.js';
import { expectPublicResponse, type SpecMethod } from './support/public-contract.js';
import { redisImage } from './support/redis-image.js';
import {
  ALLOWED_ORIGIN,
  GATEWAY_ISSUER,
  generateSigningKeys,
  testConfig,
} from './support/test-environment.js';

const IDENTITY_URL = 'http://identity-service.test';
const DOCUMENT_URL = 'http://document-service.test';
const SESSION = 'document-session';
const WITHOUT_ORGANIZATION = 'document-session-without-organization';
const OTHER_ORGANIZATION_SESSION = 'document-session-other-organization';
const OTHER_ORGANIZATION = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const DETAIL_PATH = '/v1/documents/{documentId}';
const COLLECTION_PATH = '/v1/documents';
const document = {
  id: '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f17',
  spaceId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01',
  title: 'Notes',
  body: 'Private Markdown source',
  authorUserId: CAMILLE.id,
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: '2026-11-07T08:00:00Z',
  version: 1,
};
const summary = {
  id: document.id,
  spaceId: document.spaceId,
  title: document.title,
  authorUserId: document.authorUserId,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  version: document.version,
};
const privateHeaders = { 'Cache-Control': 'private, no-store', ETag: '"1"' };

interface DocumentCall {
  readonly principal: InternalPrincipal;
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
}

describe('document routes through the public gateway', () => {
  const network = setupServer();
  const calls: DocumentCall[] = [];
  const logs: string[] = [];
  let verifier: InternalTokenVerifier;
  let redis: StartedRedisContainer;
  let app: NestExpressApplication;
  let server: App;
  let answer: (call: Request) => Response | Promise<Response>;

  async function send(
    method: Exclude<SpecMethod, 'query'>,
    path: string,
    url: string,
    options: {
      readonly session?: string | null;
      readonly body?: object;
      readonly headers?: Readonly<Record<string, string>>;
      readonly origin?: string;
    } = {},
  ): Promise<request.Response> {
    let pending = request(server)[method](url);
    if (options.session !== null) {
      pending = pending.set('Cookie', `__Host-cw_session=${options.session ?? SESSION}`);
    }
    if (method !== 'get') pending = pending.set('Origin', options.origin ?? ALLOWED_ORIGIN);
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      pending = pending.set(name, value);
    }
    const response = options.body === undefined ? await pending : await pending.send(options.body);
    expectPublicResponse(method, path, response);
    return response;
  }

  beforeAll(async () => {
    const keys = generateSigningKeys();
    verifier = await InternalTokenVerifier.create({
      audience: 'document-service',
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
    redis = await new RedisContainer(redisImage()).start();
    network.listen({ onUnhandledFrame: 'bypass' });
    network.use(
      http.post(`${IDENTITY_URL}/internal/v1/tokens/introspect`, async ({ request: call }) => {
        const input = (await call.json()) as { readonly token?: string };
        return HttpResponse.json({
          active: true,
          tokenType: 'session',
          sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a61',
          userId: CAMILLE.id,
          organizationId:
            input.token === WITHOUT_ORGANIZATION
              ? null
              : input.token === OTHER_ORGANIZATION_SESSION
                ? OTHER_ORGANIZATION
                : ATELIER_NORD_ID,
          role: input.token === WITHOUT_ORGANIZATION ? null : 'owner',
          scopes: ['tasks:read', 'tasks:write'],
          expiresAt: '2026-12-08T13:07:00Z',
        });
      }),
      http.all(`${DOCUMENT_URL}/internal/v1/documents*`, async ({ request: call }) => {
        calls.push({
          principal: await verifier.verify(
            (call.headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
          ),
          method: call.method,
          url: call.url,
          headers: call.headers,
        });
        return answer(call);
      }),
    );
    const sink = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logs.push(chunk.toString('utf8'));
        done();
      },
    });
    app = await createGatewayApplication(
      testConfig(
        {
          REDIS_URL: redis.getConnectionUrl(),
          IDENTITY_SERVICE_URL: IDENTITY_URL,
          DOCUMENT_SERVICE_URL: DOCUMENT_URL,
        },
        keys,
      ),
      sink,
    );
    await app.init();
    server = app.getHttpServer();
  });

  beforeEach(() => {
    calls.length = 0;
    logs.length = 0;
    answer = () => HttpResponse.json(document, { headers: privateHeaders });
  });

  afterAll(async () => {
    await app.close();
    network.close();
    await redis.stop();
  });

  it('lists only metadata and signs the caller and current organization', async () => {
    answer = () =>
      HttpResponse.json(
        { items: [summary], nextCursor: null },
        {
          headers: { 'Cache-Control': 'private, no-store' },
        },
      );
    const response = await send('get', COLLECTION_PATH, '/v1/documents?q=private-query&limit=1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [summary], nextCursor: null });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.principal).toMatchObject({
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
    expect(logs.join('')).not.toContain('private-query');
    expect(logs.join('')).not.toContain(document.body);
  });

  it('creates, reads, updates and deletes through the signed upstream', async () => {
    answer = () =>
      HttpResponse.json(document, {
        status: 201,
        headers: { ...privateHeaders, Location: `/internal/v1/documents/${document.id}` },
      });
    const created = await send('post', COLLECTION_PATH, COLLECTION_PATH, {
      body: { spaceId: document.spaceId, title: document.title },
      headers: { 'Idempotency-Key': 'document-create-key' },
    });
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(`/v1/documents/${document.id}`);
    expect(created.headers.etag).toBe('"1"');
    expect(calls[0]?.headers.get('Idempotency-Key')).toBe('document-create-key');

    answer = () => HttpResponse.json(document, { headers: privateHeaders });
    const current = await send('get', DETAIL_PATH, `/v1/documents/${document.id}`, {
      headers: { 'If-None-Match': '*' },
    });
    expect(current.status).toBe(200);
    expect(current.body).toEqual(document);
    expect(current.headers.etag).toBe('"1"');

    const changed = await send('patch', DETAIL_PATH, `/v1/documents/${document.id}`, {
      body: { title: document.title },
      headers: { 'If-Match': '"1"' },
    });
    expect(changed.status).toBe(200);
    expect(calls.at(-1)?.headers.get('If-Match')).toBe('"1"');

    answer = () =>
      new HttpResponse(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
    const removed = await send('delete', DETAIL_PATH, `/v1/documents/${document.id}`, {
      headers: { 'If-Match': '"1"' },
    });
    expect(removed.status).toBe(204);
    expect(removed.headers['cache-control']).toBe('private, no-store');
    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET', 'PATCH', 'DELETE']);
  });

  it('rejects missing session, missing organization and untrusted write origin before Document', async () => {
    const missing = await send('get', COLLECTION_PATH, COLLECTION_PATH, { session: null });
    expect(missing.status).toBe(401);
    expect(missing.headers['cache-control']).toBe('private, no-store');

    const noOrganization = await send('get', COLLECTION_PATH, COLLECTION_PATH, {
      session: WITHOUT_ORGANIZATION,
    });
    expect(noOrganization.status).toBe(403);
    expect(noOrganization.body).toMatchObject({ code: 'organization.not-selected' });

    const csrf = await send('post', COLLECTION_PATH, COLLECTION_PATH, {
      origin: 'https://untrusted.example',
      body: { spaceId: document.spaceId, title: document.title },
    });
    expect(csrf.status).toBe(403);
    expect(csrf.body).toMatchObject({ code: 'auth.csrf-rejected' });
    expect(csrf.headers['cache-control']).toBe('private, no-store');
    expect(calls).toHaveLength(0);
  });

  it('keeps malformed input private before forwarding', async () => {
    const malformed = await request(server)
      .post(COLLECTION_PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"title":');
    expectPublicResponse('post', COLLECTION_PATH, malformed);
    expect(malformed.status).toBe(400);
    expect(malformed.headers['cache-control']).toBe('private, no-store');
    const invalid = await send('get', DETAIL_PATH, '/V1/DOCUMENTS/%E0%A4%A');
    expect(invalid.status).toBe(400);
    expect(invalid.headers['cache-control']).toBe('private, no-store');
    expect(calls).toHaveLength(0);
  });

  it('preserves the body size error and private cache policy', async () => {
    const response = await request(server)
      .post(COLLECTION_PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ spaceId: document.spaceId, title: 'x'.repeat(1_100_000) });
    expectPublicResponse('post', COLLECTION_PATH, response);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'request.body-too-large' });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls).toHaveLength(0);
  });

  it('forwards only the selected organization when the document is not visible', async () => {
    answer = () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'document.not-found' },
        {
          status: 404,
          headers: {
            'Content-Type': 'application/problem+json',
            'Cache-Control': 'private, no-store',
          },
        },
      );
    const response = await send('get', DETAIL_PATH, `/v1/documents/${document.id}`, {
      session: OTHER_ORGANIZATION_SESSION,
    });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'document.not-found' });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls[0]?.principal.organizationId).toBe(OTHER_ORGANIZATION);
    expect(JSON.stringify(response.body)).not.toContain(document.body);
  });

  it('relays an unavailable authority without revealing private upstream data', async () => {
    answer = () =>
      HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'document.unavailable',
        },
        {
          status: 503,
          headers: {
            'Content-Type': 'application/problem+json',
            'Cache-Control': 'private, no-store',
          },
        },
      );
    const unavailable = await send('get', DETAIL_PATH, `/v1/documents/${document.id}`);
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toMatchObject({ code: 'document.unavailable' });
    expect(unavailable.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(unavailable.body)).not.toContain(document.body);
  });

  it('returns a bounded failure when the Document service is slow', async () => {
    answer = async () => {
      await delay(2_500);
      return HttpResponse.json(document, { headers: privateHeaders });
    };
    const response = await send('get', DETAIL_PATH, `/v1/documents/${document.id}`);
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(response.body)).not.toContain(document.body);
  });
});
