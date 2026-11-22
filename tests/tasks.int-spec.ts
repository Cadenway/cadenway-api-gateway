import { Writable } from 'node:stream';

import { InternalTokenVerifier, type InternalPrincipal } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { delay, http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import { ATELIER_NORD_ID, CAMILLE } from './support/fake-identity.js';
import { taskDetailCore } from './support/fake-task.js';
import {
  expectPublicResponse,
  responseExample,
  type SpecMethod,
} from './support/public-contract.js';
import { redisImage } from './support/redis-image.js';
import {
  ALLOWED_ORIGIN,
  GATEWAY_ISSUER,
  generateSigningKeys,
  testConfig,
  type SigningKeys,
} from './support/test-environment.js';

/**
 * Base URL of the faked identity-service.
 */
const IDENTITY_URL = 'http://identity-service.test';

/**
 * Base URL of the faked task-service.
 */
const TASK_URL = 'http://task-service.test';

/** Base URL of the faked storage-service. */
const STORAGE_URL = 'http://storage-service.test';

/**
 * Session cookie of Camille in Atelier Nord.
 */
const SESSION = 'session-of-camille-in-atelier-nord';

/**
 * Personal API token of Camille holding `tasks:read` only.
 */
const READ_TOKEN = 'cw_pat_TasksReadTokenOfCamille0000000000000';

/**
 * Id of the list "Sprint 14" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';

/** First comments page returned for the task detail fixture. */
const COMMENTS_PAGE = {
  items: [
    {
      ...(responseExample('post', '/v1/tasks/{taskKey}/comments', 201) as Record<
        string,
        JsonBodyType
      >),
      taskKey: 'CAD-483',
    },
  ],
  nextCursor: null,
  total: 1,
};

/**
 * A call task-service received.
 */
interface TaskCall {
  // #region Properties
  /** Method and path with its query, decoded. */
  readonly route: string;

  /** Headers of the call. */
  readonly headers: Headers;

  /** The verified internal token. */
  readonly principal: InternalPrincipal;
  // #endregion
}

describe('the task core routes against task-service over HTTP', () => {
  const logLines: string[] = [];
  const network: SetupServer = setupServer();
  const taskCalls: TaskCall[] = [];
  let keys: SigningKeys;
  let verifier: InternalTokenVerifier;
  let redis: StartedRedisContainer;
  let app: NestExpressApplication;
  let server: App;

  /**
   * Answers one call of task-service, recording it.
   *
   * @param method - Method to answer.
   * @param path - Path to answer, from `/internal`.
   * @param reply - The answer.
   */
  function taskService(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    reply: () => Response,
  ): void {
    network.use(
      http[method](`${TASK_URL}${path}`, async ({ request: call }) => {
        const url: URL = new URL(call.url);
        taskCalls.push({
          route: `${call.method} ${decodeURIComponent(`${url.pathname}${url.search}`)}`,
          headers: call.headers,
          principal: await verifier.verify(
            (call.headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
          ),
        });
        return reply();
      }),
    );
  }

  /**
   * Sends a public request with the session of Camille and checks it against the public contract.
   *
   * @param method - Method of the operation.
   * @param path - Path of the operation, as the spec writes it.
   * @param url - URL of the request.
   * @param options - Body and headers.
   * @param options.body - JSON body.
   * @param options.headers - Further headers.
   * @param options.bearer - A personal API token instead of the session cookie.
   * @returns The answer.
   */
  async function send(
    method: SpecMethod,
    path: string,
    url: string,
    options: { body?: object; headers?: Record<string, string>; bearer?: string } = {},
  ): Promise<request.Response> {
    let pending: request.Test = request(server)[method](url);
    pending =
      options.bearer === undefined
        ? pending.set('Cookie', `__Host-cw_session=${SESSION}`)
        : pending.set('Authorization', `Bearer ${options.bearer}`);
    if (method !== 'get') {
      pending = pending.set('Origin', ALLOWED_ORIGIN);
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      pending = pending.set(name, value);
    }
    const response: request.Response =
      options.body === undefined ? await pending : await pending.send(options.body);
    expectPublicResponse(method, path, response);
    return response;
  }

  beforeAll(async () => {
    keys = generateSigningKeys();
    verifier = await InternalTokenVerifier.create({
      audience: 'task-service',
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
    redis = await new RedisContainer(redisImage()).start();
    // Listening before the application exists: its internal HTTP clients take the `fetch` msw
    // intercepts when they are built. The Docker calls of Testcontainers are done by then, and the
    // requests to the gateway itself pass through unhandled.
    network.listen({ onUnhandledFrame: 'bypass' });
    network.use(
      http.post(`${IDENTITY_URL}/internal/v1/tokens/introspect`, () =>
        HttpResponse.json({
          active: true,
          tokenType: 'session',
          sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a61',
          userId: CAMILLE.id,
          organizationId: ATELIER_NORD_ID,
          role: 'owner',
          scopes: ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'],
          expiresAt: '2026-12-08T13:07:00Z',
        }),
      ),
      http.post(`${IDENTITY_URL}/internal/v1/api-tokens/introspect`, () =>
        HttpResponse.json({
          active: true,
          tokenType: 'api-token',
          apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e91',
          userId: CAMILLE.id,
          organizationId: ATELIER_NORD_ID,
          role: 'owner',
          scopes: ['tasks:read'],
          expiresAt: null,
        }),
      ),
    );
    const sink: Writable = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
        done();
      },
    });
    app = await createGatewayApplication(
      testConfig(
        {
          REDIS_URL: redis.getConnectionUrl(),
          IDENTITY_SERVICE_URL: IDENTITY_URL,
          TASK_SERVICE_URL: TASK_URL,
          STORAGE_SERVICE_URL: STORAGE_URL,
        },
        keys,
      ),
      sink,
    );
    await app.init();
    server = app.getHttpServer();
  });

  afterEach(() => {
    taskCalls.length = 0;
  });

  afterAll(async () => {
    await app.close();
    network.close();
    await redis.stop();
  });

  it('keeps the session cookie usable when Identity temporarily cannot verify membership', async () => {
    let proofUnavailable = true;
    network.use(
      http.post(`${IDENTITY_URL}/internal/v1/tokens/introspect`, () => {
        if (!proofUnavailable) {
          return;
        }
        return HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Service Unavailable',
            status: 503,
            code: 'organization.unavailable',
          },
          { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    try {
      const unavailable = await send('get', '/v1/tasks/{taskKey}', '/v1/tasks/CAD-482', {
        headers: { 'If-Organization-Match': ATELIER_NORD_ID },
      });
      expect(unavailable.status).toBe(503);
      expect(unavailable.body).toMatchObject({
        code: 'upstream.unavailable',
        details: { service: 'identity-service' },
      });
      expect(unavailable.headers['set-cookie']).toBeUndefined();
      expect(unavailable.headers['cache-control']).toBe('private, no-store');
      expect(taskCalls).toHaveLength(0);
    } finally {
      proofUnavailable = false;
    }

    taskService('get', '/internal/v1/tasks/CAD-482', () =>
      HttpResponse.json(responseExample('get', '/v1/tasks/{taskKey}', 200) as JsonBodyType),
    );
    const recovered = await send('get', '/v1/tasks/{taskKey}', '/v1/tasks/CAD-482', {
      headers: { 'If-Organization-Match': ATELIER_NORD_ID },
    });
    expect(recovered.status).toBe(200);
    expect(taskCalls.map((call) => call.principal.organizationId)).toEqual([ATELIER_NORD_ID]);
  });

  it('reads a nullable attachment author through authenticated Storage list and detail calls', async () => {
    const taskKey = 'CAD-482';
    const id = '019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f15';
    const path = `/internal/v1/tasks/${taskKey}/attachments`;
    const attachment = {
      id,
      taskKey,
      fileName: 'capture.png',
      contentType: 'image/png',
      sizeBytes: 100,
      authorUserId: null,
      uploadedAt: '2026-11-20T10:00:00Z',
      version: 3,
    };
    const storageVerifier = await InternalTokenVerifier.create({
      audience: 'storage-service',
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
    const callers: InternalPrincipal[] = [];
    taskService(
      'get',
      `/internal/v1/tasks/${taskKey}/attachment-access`,
      () => new HttpResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }),
    );
    network.use(
      http.get(`${STORAGE_URL}${path}/:attachmentId?`, async ({ request: call, params }) => {
        callers.push(
          await storageVerifier.verify(
            (call.headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
          ),
        );
        return params.attachmentId === undefined
          ? HttpResponse.json({ items: [attachment], nextCursor: null })
          : HttpResponse.json(attachment, { headers: { ETag: '"3"' } });
      }),
    );

    const list = await send(
      'get',
      '/v1/tasks/{taskKey}/attachments',
      `/v1/tasks/${taskKey}/attachments`,
    );
    const detail = await send(
      'get',
      '/v1/tasks/{taskKey}/attachments/{attachmentId}',
      `/v1/tasks/${taskKey}/attachments/${id}`,
    );
    expect(list.status).toBe(200);
    expect(list.body).toEqual({ items: [attachment], nextCursor: null });
    expect(detail.status).toBe(200);
    expect(detail.headers.etag).toBe('"3"');
    expect(detail.body).toEqual(attachment);
    expect(taskCalls.map((call) => call.route)).toEqual([
      `GET /internal/v1/tasks/${taskKey}/attachment-access?mode=read`,
      `GET /internal/v1/tasks/${taskKey}/attachment-access?mode=read`,
    ]);
    expect(callers).toHaveLength(2);
    for (const caller of callers) {
      expect(caller).toMatchObject({
        actor: { type: 'user', id: CAMILLE.id },
        organizationId: ATELIER_NORD_ID,
      });
    }
  });

  it('creates a task with its Idempotency-Key relayed, answering its Location and ETag', async () => {
    const created: unknown = responseExample('post', '/v1/lists/{listId}/tasks', 201);
    taskService('post', `/internal/v1/lists/${LIST_ID}/tasks`, () =>
      HttpResponse.json(created as JsonBodyType, {
        status: 201,
        headers: { Location: '/internal/v1/tasks/CAD-732', ETag: '"1"' },
      }),
    );

    const response: request.Response = await send(
      'post',
      '/v1/lists/{listId}/tasks',
      `/v1/lists/${LIST_ID}/tasks`,
      {
        body: { name: 'Ajouter la connexion par lien magique', labels: ['Auth'] },
        headers: { 'Idempotency-Key': '5d0c6f1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f' },
      },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.headers.location).toBe('/v1/tasks/CAD-732');
    expect(response.headers.etag).toBe('"1"');
    expect(taskCalls).toHaveLength(1);
    expect(taskCalls[0]?.headers.get('Idempotency-Key')).toBe(
      '5d0c6f1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
    );
    expect(taskCalls[0]?.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
  });

  it('composes the detail of a task with partial empty and the ETag of the task', async () => {
    taskService('get', '/internal/v1/tasks/CAD-483/detail', () =>
      HttpResponse.json(taskDetailCore() as JsonBodyType),
    );
    taskService('get', '/internal/v1/tasks/CAD-483/comments', () =>
      HttpResponse.json(COMMENTS_PAGE),
    );

    const response: request.Response = await send(
      'get',
      '/v1/tasks/{taskKey}/detail',
      '/v1/tasks/CAD-483/detail',
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({ ...taskDetailCore(), comments: COMMENTS_PAGE, partial: [] });
    expect(response.headers.etag).toBe(`"${String(taskDetailCore().task.version)}"`);
  });

  it('fails the whole detail when the comments read denies visibility', async () => {
    taskService('get', '/internal/v1/tasks/CAD-483/detail', () =>
      HttpResponse.json(taskDetailCore() as JsonBodyType),
    );
    taskService('get', '/internal/v1/tasks/CAD-483/comments', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'task.not-found' },
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const response = await send('get', '/v1/tasks/{taskKey}/detail', '/v1/tasks/CAD-483/detail');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'task.not-found' });
    expect(response.body).not.toHaveProperty('partial');
    expect(taskCalls.map((call: TaskCall) => call.route)).toEqual(
      expect.arrayContaining([
        'GET /internal/v1/tasks/CAD-483/detail',
        'GET /internal/v1/tasks/CAD-483/comments?limit=50',
      ]),
    );
  });

  it.each([
    [403, 'auth.issuer-not-allowed'],
    [404, 'comment.not-found'],
  ])('returns partial comments for an internal %i %s', async (status, code) => {
    taskService('get', '/internal/v1/tasks/CAD-483/detail', () =>
      HttpResponse.json(taskDetailCore() as JsonBodyType),
    );
    taskService('get', '/internal/v1/tasks/CAD-483/comments', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Internal', status, code },
        { status, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const response = await send('get', '/v1/tasks/{taskKey}/detail', '/v1/tasks/CAD-483/detail');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...taskDetailCore(), partial: ['comments'] });
  });

  it('answers the slow core problem when comments deny visibility first', async () => {
    network.use(
      http.get(`${TASK_URL}/internal/v1/tasks/CAD-483/detail`, async () => {
        await delay(100);
        return HttpResponse.json(
          { type: 'about:blank', title: 'Internal', status: 404, code: 'task.trashed' },
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );
    taskService('get', '/internal/v1/tasks/CAD-483/comments', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Internal', status: 404, code: 'task.not-found' },
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const response = await send('get', '/v1/tasks/{taskKey}/detail', '/v1/tasks/CAD-483/detail');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'task.trashed' });
  });

  it('returns the authorized core with partial comments after the part deadline', async () => {
    taskService('get', '/internal/v1/tasks/CAD-483/detail', () =>
      HttpResponse.json(taskDetailCore() as JsonBodyType),
    );
    network.use(
      http.get(`${TASK_URL}/internal/v1/tasks/CAD-483/comments`, async () => {
        await delay(1200);
        return HttpResponse.json(COMMENTS_PAGE);
      }),
    );
    const response = await send('get', '/v1/tasks/{taskKey}/detail', '/v1/tasks/CAD-483/detail');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...taskDetailCore(), partial: ['comments'] });
    await delay(500);
  });

  it('reads "Accueil" for the user of the session, on the today of the caller', async () => {
    taskService('get', `/internal/v1/users/${CAMILLE.id}/home`, () =>
      HttpResponse.json(responseExample('get', '/v1/me/home', 200) as JsonBodyType),
    );

    const response: request.Response = await send(
      'get',
      '/v1/me/home',
      '/v1/me/home?today=2026-11-18',
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(taskCalls.map((call: TaskCall) => call.route)).toEqual([
      `GET /internal/v1/users/${CAMILLE.id}/home?today=2026-11-18`,
    ]);
  });

  it('relays the filters of a list as declared, the array ones comma-separated', async () => {
    taskService('get', `/internal/v1/lists/${LIST_ID}/tasks`, () =>
      HttpResponse.json(responseExample('get', '/v1/lists/{listId}/tasks', 200) as JsonBodyType),
    );

    const response: request.Response = await send(
      'get',
      '/v1/lists/{listId}/tasks',
      `/v1/lists/${LIST_ID}/tasks?status=progress,review&assignee=me&sort=-dueDate`,
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(taskCalls.map((call: TaskCall) => call.route)).toEqual([
      `GET /internal/v1/lists/${LIST_ID}/tasks?status=progress,review&assignee=me&level=roots&sort=-dueDate&limit=50`,
    ]);
  });

  it('relays If-Match on a change, and a stale version as 412 with its French title', async () => {
    taskService('patch', '/internal/v1/tasks/CAD-482', () =>
      HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Precondition Failed',
          status: 412,
          code: 'request.version-mismatch',
          details: { version: 14 },
        },
        { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const response: request.Response = await send(
      'patch',
      '/v1/tasks/{taskKey}',
      '/v1/tasks/CAD-482',
      { body: { status: 'review' }, headers: { 'If-Match': '"12"' } },
    );

    expect(response.status).toBe(412);
    expect(response.body).toMatchObject({
      code: 'request.version-mismatch',
      title: 'Ces informations ont été modifiées entre-temps : rechargez la page.',
      details: { version: 14 },
    });
    expect(taskCalls[0]?.headers.get('If-Match')).toBe('"12"');
  });

  it('answers a task the caller does not see 404 task.not-found, as task-service does', async () => {
    taskService('get', '/internal/v1/tasks/CAD-999', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'task.not-found' },
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const response: request.Response = await send(
      'get',
      '/v1/tasks/{taskKey}',
      '/v1/tasks/CAD-999',
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'task.not-found', title: 'Tâche introuvable.' });
  });

  it('refuses a write of a token holding tasks:read only, without calling task-service', async () => {
    const response: request.Response = await send(
      'post',
      '/v1/tasks/{taskKey}/labels/add',
      '/v1/tasks/CAD-482/labels/add',
      { body: { name: 'Sécurité' }, bearer: READ_TOKEN },
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'auth.scope-missing' });
    expect(taskCalls).toHaveLength(0);
  });

  it('writes no session token or internal token into the logs', () => {
    const logs: string = logLines.join('\n');

    expect(logs).not.toContain(SESSION);
    expect(logs).not.toContain(READ_TOKEN);
    expect(logs).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./u);
  });
  it('returns the core and marks only comments partial when comments are unavailable', async () => {
    taskService('get', '/internal/v1/tasks/CAD-483/detail', () =>
      HttpResponse.json(taskDetailCore() as JsonBodyType),
    );
    taskService('get', '/internal/v1/tasks/CAD-483/comments', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Unavailable', status: 503, code: 'service.unavailable' },
        { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const response = await send('get', '/v1/tasks/{taskKey}/detail', '/v1/tasks/CAD-483/detail');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...taskDetailCore(), partial: ['comments'] });
    expect(response.body).not.toHaveProperty('comments');
    expect(response.headers.etag).toBe(`"${String(taskDetailCore().task.version)}"`);
    expect(taskCalls.map((call: TaskCall) => call.route)).toEqual(
      expect.arrayContaining([
        'GET /internal/v1/tasks/CAD-483/detail',
        'GET /internal/v1/tasks/CAD-483/comments?limit=50',
      ]),
    );
  });
});
