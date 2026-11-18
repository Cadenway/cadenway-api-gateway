import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  ProblemException,
  runWithOrganizationContext,
  type Ed25519PrivateJwk,
  type InternalPrincipal,
  type OrganizationContext,
} from '@cadenway/nest-common';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { taskDetailCore } from '../../tests/support/fake-task.js';
import { responseExample } from '../../tests/support/public-contract.js';
import {
  GATEWAY_ISSUER,
  generateSigningKeys,
  type SigningKeys,
} from '../../tests/support/test-environment.js';
import { TASK_SERVICE, TaskServiceClient } from './task-service.client.js';

/**
 * Base URL of the faked task-service.
 */
const BASE_URL = 'http://task-service.test';

/**
 * Camille in Atelier Nord, the context of the calls.
 */
const CAMILLE_IN_ATELIER_NORD: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: ['tasks:read', 'tasks:write'],
};

/**
 * A call task-service received.
 */
interface ReceivedCall {
  // #region Properties
  /** HTTP method. */
  readonly method: string;

  /** Path and query, decoded. */
  readonly url: string;

  /** Parsed JSON body, `undefined` without one. */
  readonly body: unknown;

  /** `If-Match`, or `null`. */
  readonly ifMatch: string | null;

  /** `Idempotency-Key`, or `null`. */
  readonly idempotencyKey: string | null;

  /** The verified internal token. */
  readonly principal: InternalPrincipal;
  // #endregion
}

describe('TaskServiceClient against task-service over HTTP', () => {
  const server: SetupServer = setupServer();
  let verifier: InternalTokenVerifier;
  let signer: InternalTokenSigner;
  let calls: ReceivedCall[];
  let client: TaskServiceClient;

  /**
   * Answers every call of one method and path with what `reply` builds, recording the call.
   *
   * @param method - Method to answer.
   * @param path - Path to answer, from `/internal`.
   * @param reply - The answer.
   */
  function answer(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    reply: () => Response,
  ): void {
    server.use(
      http[method](`${BASE_URL}${path}`, async ({ request }) => {
        const text: string = await request.text();
        const url: URL = new URL(request.url);
        calls.push({
          method: request.method,
          url: decodeURIComponent(`${url.pathname}${url.search}`),
          body: text === '' ? undefined : (JSON.parse(text) as unknown),
          ifMatch: request.headers.get('If-Match'),
          idempotencyKey: request.headers.get('Idempotency-Key'),
          principal: await verifier.verify(
            (request.headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
          ),
        });
        return reply();
      }),
    );
  }

  /**
   * Builds a JSON answer.
   *
   * @param body - The body.
   * @param status - The status.
   * @param headers - Further headers.
   * @returns The answer.
   */
  function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return HttpResponse.json(body as JsonBodyType, { status, headers });
  }

  /**
   * Runs a call as Camille in Atelier Nord.
   *
   * @param call - The call.
   * @returns What the call resolved with.
   */
  function asCamille<TResult>(call: () => Promise<TResult>): Promise<TResult> {
    return runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, call);
  }

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'error' });
    const keys: SigningKeys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: TASK_SERVICE,
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
  });

  beforeEach(() => {
    calls = [];
    // Built after `listen`: the internal HTTP client takes the `fetch` msw intercepts.
    client = new TaskServiceClient(
      new InternalHttpClient({ service: TASK_SERVICE, baseUrl: BASE_URL, signer }),
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('reads a task with an internal token for task-service carrying the user and the organization', async () => {
    const task: unknown = responseExample('get', '/v1/tasks/{taskKey}', 200);
    answer('get', '/internal/v1/tasks/CAD-482', () => json(task));

    await expect(asCamille(() => client.getTask('CAD-482'))).resolves.toEqual(task);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
  });

  it('sends the array filters comma-separated and every other parameter as declared', async () => {
    answer('get', '/internal/v1/lists/:listId/tasks', () =>
      json(responseExample('get', '/v1/lists/{listId}/tasks', 200)),
    );

    await asCamille(() =>
      client.listTasks('019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12', {
        status: ['progress', 'review'],
        assignee: ['me'],
        level: 'roots',
        sort: 'manual',
        limit: 10,
      }),
    );

    expect(calls[0]?.url).toBe(
      '/internal/v1/lists/019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12/tasks?status=progress,review&assignee=me&level=roots&sort=manual&limit=10',
    );
  });

  it('relays the today of the caller and the user of the context on the home', async () => {
    answer('get', '/internal/v1/users/:userId/home', () =>
      json(responseExample('get', '/v1/me/home', 200)),
    );

    await asCamille(() => client.getHome(CAMILLE.id, { today: '2026-11-18' }));

    expect(calls[0]?.url).toBe(`/internal/v1/users/${CAMILLE.id}/home?today=2026-11-18`);
  });

  it('relays Idempotency-Key on a creation and retries it once after a 503, as task-service replays it', async () => {
    let attempts = 0;
    answer('post', '/internal/v1/lists/:listId/tasks', () => {
      attempts += 1;
      return attempts === 1
        ? json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503)
        : json(responseExample('post', '/v1/lists/{listId}/tasks', 201), 201);
    });

    await asCamille(() =>
      client.createTask(
        '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12',
        { name: 'Ajouter la connexion par lien magique' },
        'creation-1',
      ),
    );

    expect(calls.map((call: ReceivedCall) => call.idempotencyKey)).toEqual([
      'creation-1',
      'creation-1',
    ]);
    expect(calls[1]?.body).toMatchObject({
      name: 'Ajouter la connexion par lien magique',
      status: 'todo',
      priority: 'moyenne',
    });
  });

  it('never retries a change carrying If-Match, whose repeat would answer 412', async () => {
    answer('patch', '/internal/v1/tasks/CAD-482', () =>
      json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503),
    );

    await expect(
      asCamille(() => client.updateTask('CAD-482', { name: 'Renommée' }, '"12"')),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.unavailable' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.ifMatch).toBe('"12"');
  });

  it('reads the version of an unassignment from the ETag of its 204', async () => {
    answer(
      'delete',
      `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: { ETag: '"13"' } }),
    );

    await expect(asCamille(() => client.unassignTask('CAD-482', CAMILLE.id, '"12"'))).resolves.toBe(
      13,
    );
  });

  it('answers an unassignment without a strong ETag as 503 upstream.failed', async () => {
    answer(
      'delete',
      `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: { ETag: 'W/"13"' } }),
    );

    await expect(
      asCamille(() => client.unassignTask('CAD-482', CAMILLE.id, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('reads the id of a checklist item from the Location task-service answers', async () => {
    const id = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e99';
    answer('post', '/internal/v1/tasks/CAD-482/checklist-items', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/checklist-items', 201), 201, {
        Location: `/internal/v1/tasks/CAD-482/checklist-items/${id}`,
      }),
    );

    const added = await asCamille(() =>
      client.addChecklistItem('CAD-482', { text: 'Relire les messages' }, undefined),
    );

    expect(added.checklistItemId).toBe(id);
  });

  it('answers a checklist item without a Location naming it as 503 upstream.failed', async () => {
    answer('post', '/internal/v1/tasks/CAD-482/checklist-items', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/checklist-items', 201), 201),
    );

    await expect(
      asCamille(() => client.addChecklistItem('CAD-482', { text: 'Relire' }, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('reads the core of the detail, checked against the internal contract', async () => {
    answer('get', '/internal/v1/tasks/CAD-483/detail', () => json(taskDetailCore()));

    await expect(asCamille(() => client.getTaskDetail('CAD-483'))).resolves.toEqual(
      taskDetailCore(),
    );
  });

  it('relays a client error with its code and details, naming task-service', async () => {
    answer('patch', '/internal/v1/tasks/CAD-482', () =>
      json(
        {
          type: 'about:blank',
          title: 'Internal wording',
          status: 412,
          code: 'request.version-mismatch',
          details: { version: 14 },
        },
        412,
      ),
    );

    const failure: unknown = await asCamille(() =>
      client.updateTask('CAD-482', { name: 'x' }, '"12"'),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProblemException);
    expect((failure as ProblemException).problem).toMatchObject({
      status: 412,
      code: 'request.version-mismatch',
      details: { version: 14, service: TASK_SERVICE },
    });
  });

  it('answers an answer outside the internal contract as 503 upstream.failed', async () => {
    answer('get', '/internal/v1/labels', () => json({ items: 'not a list' }));

    await expect(asCamille(() => client.listLabels({ limit: 20 }))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed', details: { service: TASK_SERVICE } },
    });
  });

  it('refuses to send a request outside the internal contract, without calling', async () => {
    await expect(asCamille(async () => client.listLabels({ limit: 0 }))).rejects.toThrow(
      'outside the internal contract: limit',
    );
    expect(calls).toHaveLength(0);
  });

  it('sends every space, list and task call to its internal path', async () => {
    const SPACE = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
    const LIST = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
    const ITEM = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e10';
    const routes: readonly [
      'get' | 'post' | 'put' | 'patch',
      string,
      string,
      number,
      () => Promise<unknown>,
    ][] = [
      ['get', '/internal/v1/spaces', '/v1/spaces', 200, () => client.listSpaces({ limit: 20 })],
      [
        'post',
        '/internal/v1/spaces',
        '/v1/spaces',
        201,
        () => client.createSpace({ name: 'RH', prefix: 'RH' }, undefined),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE}`,
        '/v1/spaces/{spaceId}',
        200,
        () => client.getSpace(SPACE),
      ],
      [
        'patch',
        `/internal/v1/spaces/${SPACE}`,
        '/v1/spaces/{spaceId}',
        200,
        () => client.updateSpace(SPACE, { name: 'Produit' }, undefined),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE}/overview`,
        '/v1/spaces/{spaceId}/overview',
        200,
        () => client.getSpaceOverview(SPACE, { today: '2026-11-18', limit: 20 }),
      ],
      [
        'post',
        `/internal/v1/spaces/${SPACE}/lists`,
        '/v1/spaces/{spaceId}/lists',
        201,
        () => client.createList(SPACE, { name: 'Sprint 15' }, 'k'),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE}/lists`,
        '/v1/spaces/{spaceId}/lists',
        200,
        () => client.listLists(SPACE, { limit: 20 }),
      ],
      ['get', `/internal/v1/lists/${LIST}`, '/v1/lists/{listId}', 200, () => client.getList(LIST)],
      [
        'patch',
        `/internal/v1/lists/${LIST}`,
        '/v1/lists/{listId}',
        200,
        () => client.updateList(LIST, { name: 'Sprint 14' }, '"2"'),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST}/counts`,
        '/v1/lists/{listId}/counts',
        200,
        () => client.getListCounts(LIST, { today: '2026-11-18' }),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST}/activity`,
        '/v1/lists/{listId}/activity',
        200,
        () => client.listListActivity(LIST, { limit: 20 }),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST}/task-groups`,
        '/v1/lists/{listId}/task-groups',
        200,
        () => client.countTaskGroups(LIST, { groupBy: 'status', level: 'roots', limit: 20 }),
      ],
      [
        'get',
        '/internal/v1/tasks/CAD-482/subtasks',
        '/v1/tasks/{taskKey}/subtasks',
        200,
        () => client.listSubtasks('CAD-482', { limit: 20 }),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/subtasks',
        '/v1/tasks/{taskKey}/subtasks',
        201,
        () => client.createSubtask('CAD-482', { name: 'Tester' }, undefined),
      ],
      [
        'patch',
        `/internal/v1/tasks/CAD-482/checklist-items/${ITEM}`,
        '/v1/tasks/{taskKey}/checklist-items/{checklistItemId}',
        200,
        () => client.updateChecklistItem('CAD-482', ITEM, { done: true }, undefined),
      ],
      [
        'put',
        `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
        '/v1/tasks/{taskKey}/assignees/{userId}',
        200,
        () => client.assignTask('CAD-482', CAMILLE.id, undefined),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/labels/add',
        '/v1/tasks/{taskKey}/labels/add',
        200,
        () => client.addTaskLabel('CAD-482', { name: 'Sécurité' }, '"12"'),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/labels/remove',
        '/v1/tasks/{taskKey}/labels/remove',
        200,
        () => client.removeTaskLabel('CAD-482', { name: 'Front' }, undefined),
      ],
      [
        'get',
        '/internal/v1/tasks/CAD-482/activity',
        '/v1/tasks/{taskKey}/activity',
        200,
        () => client.listTaskActivity('CAD-482', { limit: 20 }),
      ],
      [
        'get',
        `/internal/v1/users/${CAMILLE.id}/tasks`,
        '/v1/me/tasks',
        200,
        () => client.listMyTasks(CAMILLE.id, { state: 'open', limit: 20 }),
      ],
    ];
    for (const [method, internalPath, publicPath, status] of routes) {
      answer(method, internalPath, () =>
        json(responseExample(method === 'put' ? 'put' : method, publicPath, status), status),
      );
    }

    for (const [, , , , call] of routes) {
      await asCamille(call);
    }

    expect(
      calls.map((call: ReceivedCall) => `${call.method} ${call.url.split('?')[0] ?? ''}`),
    ).toEqual(routes.map(([method, internalPath]) => `${method.toUpperCase()} ${internalPath}`));
  });
});
