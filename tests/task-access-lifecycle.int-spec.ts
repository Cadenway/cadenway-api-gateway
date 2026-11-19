import { Writable } from 'node:stream';

import { InternalTokenVerifier, type InternalPrincipal } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { http, HttpResponse, type JsonBodyType } from 'msw';
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

/**
 * Session cookie of Camille in Atelier Nord, unique to this file.
 */
const SESSION = 'session-of-camille-in-atelier-nord-access-lifecycle';

/**
 * Personal API token of Camille holding `tasks:read` only, unique to this file.
 */
const READ_TOKEN = 'cw_pat_AccessLifecycleReadTokenOfCamille000';

/**
 * Id of the space "Produit" of the contract examples.
 */
const SPACE_ID = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';

/**
 * Id of the list "Sprint 14" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';

/**
 * Id of Léa Petit, given a role on "Sprint 14" in the contract examples.
 */
const GRANTEE_ID = '019a6f00-1b2c-7d3e-8f4a-5b6c7d8e9f40';

/**
 * Details of `404 task.trashed` in the contract example, as task-service answers them.
 */
const TRASHED_DETAILS = {
  key: 'CAD-452',
  name: 'Ancien écran de connexion',
  entryId: '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01',
  rootKey: 'CAD-452',
  trashedAt: '2026-11-06T16:20:00Z',
  trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
  purgeAt: '2026-12-06T16:20:00Z',
} as const;

/**
 * A call task-service received through a handler of this file.
 */
interface TaskCall {
  // #region Properties
  /** Method and path with its query, decoded. */
  readonly route: string;

  /** Headers of the call. */
  readonly headers: Headers;

  /** The JSON body of the call, `undefined` without one. */
  readonly body: unknown;

  /** The verified internal token. */
  readonly principal: InternalPrincipal;
  // #endregion
}

/**
 * Builds a problem answer of task-service.
 *
 * @param status - Status of the problem.
 * @param code - Code of the problem.
 * @param details - Details of the problem.
 * @returns The answer.
 */
function taskServiceProblem(
  status: number,
  code: string,
  details?: Readonly<Record<string, unknown>>,
): Response {
  return HttpResponse.json(
    {
      type: 'about:blank',
      title: 'Internal wording',
      status,
      code,
      ...(details === undefined ? {} : { details }),
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

describe('the access and lifecycle routes against task-service over HTTP', () => {
  const logLines: string[] = [];
  const network: SetupServer = setupServer();
  const taskCalls: TaskCall[] = [];
  // Every request to the task-service origin over the whole file, handled or not, never cleared.
  const everyTaskRequest: string[] = [];
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
        const text: string = await call.text();
        taskCalls.push({
          route: `${call.method} ${decodeURIComponent(`${url.pathname}${url.search}`)}`,
          headers: call.headers,
          body: text === '' ? undefined : (JSON.parse(text) as unknown),
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

  /**
   * Expects the one call task-service received to carry the internal token of Camille.
   *
   * @param route - Method and path of the expected call.
   * @returns The call.
   */
  function onlyCall(route: string): TaskCall {
    expect(taskCalls.map((call: TaskCall) => call.route)).toEqual([route]);
    const [call] = taskCalls;
    if (call === undefined) {
      throw new Error(`task-service received no ${route}.`);
    }
    expect(call.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
    return call;
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
    network.events.on('request:start', ({ request: call }) => {
      const url: URL = new URL(call.url);
      if (url.origin === TASK_URL) {
        everyTaskRequest.push(`${call.method} ${url.pathname}`);
      }
    });
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

  it('changes a grant with If-Match and the body relayed, answering the grant and its ETag', async () => {
    const grant: unknown = responseExample('put', '/v1/lists/{listId}/grants/{userId}', 200);
    taskService('put', `/internal/v1/lists/${LIST_ID}/grants/${GRANTEE_ID}`, () =>
      HttpResponse.json(grant as JsonBodyType, { headers: { ETag: '"6"' } }),
    );

    const response: request.Response = await send(
      'put',
      '/v1/lists/{listId}/grants/{userId}',
      `/v1/lists/${LIST_ID}/grants/${GRANTEE_ID}`,
      { body: { role: 'comment' }, headers: { 'If-Match': '"5"' } },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual(grant);
    expect(response.headers.etag).toBe('"6"');
    const call: TaskCall = onlyCall(`PUT /internal/v1/lists/${LIST_ID}/grants/${GRANTEE_ID}`);
    expect(call.headers.get('If-Match')).toBe('"5"');
    expect(call.body).toEqual({ role: 'comment' });
  });

  it('takes an access request with 202 and no body', async () => {
    taskService(
      'post',
      '/internal/v1/access-requests',
      () => new HttpResponse(null, { status: 202 }),
    );
    const creation = { taskKey: 'DIR-12', message: null };

    const response: request.Response = await send(
      'post',
      '/v1/access-requests',
      '/v1/access-requests',
      { body: creation },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(202);
    expect(response.text).toBe('');
    expect(onlyCall('POST /internal/v1/access-requests').body).toEqual(creation);
  });

  it('answers 429 access-request.limit-reached with Retry-After rounded up to whole seconds', async () => {
    const nextAvailableAt: string = new Date(Date.now() + 90_400).toISOString();
    taskService('post', '/internal/v1/access-requests', () =>
      taskServiceProblem(429, 'access-request.limit-reached', { nextAvailableAt }),
    );
    const sentAt: number = Date.now();

    const response: request.Response = await send(
      'post',
      '/v1/access-requests',
      '/v1/access-requests',
      { body: { taskKey: 'DIR-12', message: null } },
    );
    const answeredAt: number = Date.now();

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Trop de demandes d’accès : réessayez plus tard.',
      status: 429,
      code: 'access-request.limit-reached',
      details: { nextAvailableAt },
    });
    const retryAfter = String(response.headers['retry-after']);
    expect(retryAfter).toMatch(/^[1-9]\d*$/u);
    const until: number = Date.parse(nextAvailableAt);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(Math.ceil((until - answeredAt) / 1000));
    expect(Number(retryAfter)).toBeLessThanOrEqual(Math.ceil((until - sentAt) / 1000));
  });

  it('answers Retry-After 1 at least when nextAvailableAt is already past', async () => {
    taskService('post', '/internal/v1/access-requests', () =>
      taskServiceProblem(429, 'access-request.limit-reached', {
        nextAvailableAt: new Date(Date.now() - 5_000).toISOString(),
      }),
    );

    const response: request.Response = await send(
      'post',
      '/v1/access-requests',
      '/v1/access-requests',
      { body: { spaceId: SPACE_ID, message: null } },
    );

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('1');
  });

  it('archives a task, answering it with archivedAt, archivedBy and its ETag', async () => {
    const archived: unknown = responseExample('post', '/v1/tasks/{taskKey}/archive', 200);
    taskService('post', '/internal/v1/tasks/CAD-430/archive', () =>
      HttpResponse.json(archived as JsonBodyType, { headers: { ETag: '"7"' } }),
    );

    const response: request.Response = await send(
      'post',
      '/v1/tasks/{taskKey}/archive',
      '/v1/tasks/CAD-430/archive',
      { body: {}, headers: { 'If-Match': '"6"' } },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual(archived);
    expect(response.body).toMatchObject({
      archivedAt: '2026-11-05T11:30:00Z',
      archivedBy: { type: 'user', id: '019a5f3c-a0b1-7c2d-9e3f-5a6b7c8d9e32' },
    });
    expect(response.headers.etag).toBe('"7"');
    const call: TaskCall = onlyCall('POST /internal/v1/tasks/CAD-430/archive');
    expect(call.headers.get('If-Match')).toBe('"6"');
    expect(call.body).toEqual({});
  });

  it('trashes a task, answering its trash entry', async () => {
    const entry: unknown = responseExample('post', '/v1/tasks/{taskKey}/trash', 200);
    taskService('post', '/internal/v1/tasks/CAD-482/trash', () =>
      HttpResponse.json(entry as JsonBodyType),
    );

    const response: request.Response = await send(
      'post',
      '/v1/tasks/{taskKey}/trash',
      '/v1/tasks/CAD-482/trash',
      { body: {}, headers: { 'If-Match': '"12"' } },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual(entry);
    expect(onlyCall('POST /internal/v1/tasks/CAD-482/trash').headers.get('If-Match')).toBe('"12"');
  });

  it('answers a task in the trash 404 task.trashed with its details, without the service', async () => {
    taskService('get', '/internal/v1/tasks/CAD-452', () =>
      taskServiceProblem(404, 'task.trashed', TRASHED_DETAILS),
    );

    const response: request.Response = await send(
      'get',
      '/v1/tasks/{taskKey}',
      '/v1/tasks/CAD-452',
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Cette tâche a été supprimée',
      status: 404,
      code: 'task.trashed',
      details: TRASHED_DETAILS,
    });
    onlyCall('GET /internal/v1/tasks/CAD-452');
  });

  it('fails the detail of a task in the trash as a whole with 404 task.trashed and its details', async () => {
    taskService('get', '/internal/v1/tasks/CAD-452/detail', () =>
      taskServiceProblem(404, 'task.trashed', TRASHED_DETAILS),
    );

    const response: request.Response = await send(
      'get',
      '/v1/tasks/{taskKey}/detail',
      '/v1/tasks/CAD-452/detail',
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Cette tâche a été supprimée',
      status: 404,
      code: 'task.trashed',
      details: TRASHED_DETAILS,
    });
    onlyCall('GET /internal/v1/tasks/CAD-452/detail');
  });

  it('still composes the detail of a live task once others are in the trash', async () => {
    taskService('get', '/internal/v1/tasks/CAD-483/detail', () =>
      HttpResponse.json(taskDetailCore() as JsonBodyType),
    );

    const response: request.Response = await send(
      'get',
      '/v1/tasks/{taskKey}/detail',
      '/v1/tasks/CAD-483/detail',
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({ ...taskDetailCore(), partial: [] });
  });

  it('deletes a list with 204 and its If-Match relayed', async () => {
    taskService(
      'delete',
      `/internal/v1/lists/${LIST_ID}`,
      () => new HttpResponse(null, { status: 204 }),
    );

    const response: request.Response = await send(
      'delete',
      '/v1/lists/{listId}',
      `/v1/lists/${LIST_ID}`,
      { headers: { 'If-Match': '"3"' } },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(204);
    expect(response.text).toBe('');
    expect(onlyCall(`DELETE /internal/v1/lists/${LIST_ID}`).headers.get('If-Match')).toBe('"3"');
  });

  it('deletes a space with 204 and its If-Match relayed', async () => {
    taskService(
      'delete',
      `/internal/v1/spaces/${SPACE_ID}`,
      () => new HttpResponse(null, { status: 204 }),
    );

    const response: request.Response = await send(
      'delete',
      '/v1/spaces/{spaceId}',
      `/v1/spaces/${SPACE_ID}`,
      { headers: { 'If-Match': '"9"' } },
    );

    expect(response.status, JSON.stringify(response.body)).toBe(204);
    expect(response.text).toBe('');
    expect(onlyCall(`DELETE /internal/v1/spaces/${SPACE_ID}`).headers.get('If-Match')).toBe('"9"');
  });

  it('empties the trash with 202 and the count of the entries taken out', async () => {
    const emptied: unknown = responseExample('post', '/v1/trash/empty', 202);
    taskService('post', '/internal/v1/trash/empty', () =>
      HttpResponse.json(emptied as JsonBodyType, { status: 202 }),
    );

    const response: request.Response = await send('post', '/v1/trash/empty', '/v1/trash/empty', {
      body: {},
    });

    expect(response.status, JSON.stringify(response.body)).toBe(202);
    expect(response.body).toEqual(emptied);
    expect(onlyCall('POST /internal/v1/trash/empty').body).toEqual({});
  });

  it('refuses a grant change of a token holding tasks:read only, without calling task-service', async () => {
    const before: number = everyTaskRequest.length;

    const response: request.Response = await send(
      'put',
      '/v1/lists/{listId}/grants/{userId}',
      `/v1/lists/${LIST_ID}/grants/${GRANTEE_ID}`,
      { body: { role: 'edit' }, bearer: READ_TOKEN },
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'auth.scope-missing' });
    expect(taskCalls).toHaveLength(0);
    expect(everyTaskRequest).toHaveLength(before);
  });

  it('never reaches an /access route of task-service, which only realtime-gateway calls', () => {
    expect(everyTaskRequest.length).toBeGreaterThanOrEqual(12);
    expect(everyTaskRequest.filter((route: string) => route.endsWith('/access'))).toEqual([]);
  });

  it('writes no session token or internal token into the logs', () => {
    const logs: string = logLines.join('\n');

    expect(logs).not.toContain(SESSION);
    expect(logs).not.toContain(READ_TOKEN);
    expect(logs).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./u);
  });
});
