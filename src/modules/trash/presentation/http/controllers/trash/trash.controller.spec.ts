import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { taskProblem } from '../../../../../../../tests/support/fake-task.js';
import { responseExample } from '../../../../../../../tests/support/public-contract.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import {
  expectEveryDeclaredStatus,
  runRouteCase,
  type RouteCase,
} from '../../../../../../../tests/support/route-cases.js';
import {
  taskRouteCases,
  type TaskRoute,
} from '../../../../../../../tests/support/task-route-matrix.js';

/**
 * Key of the task "Refondre l’écran de connexion SSO" of the contract examples.
 */
const TASK_KEY = 'CAD-482';

/**
 * Id of the trash entry of CAD-452 of the contract examples.
 */
const ENTRY_ID = '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01';

/**
 * The `details` of `404 task.trashed` in the contract example: the entry CAD-452 is in.
 */
const TASK_TRASHED_DETAILS = {
  key: 'CAD-452',
  name: 'Ancien écran de connexion',
  entryId: ENTRY_ID,
  rootKey: 'CAD-452',
  trashedAt: '2026-11-06T16:20:00Z',
  trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
  purgeAt: '2026-12-06T16:20:00Z',
};

/**
 * The routes of `openapi/public/trash.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/trash',
    url: `/v1/tasks/${TASK_KEY}/trash`,
    call: 'trashTask',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK_KEY, {}, '"12"'],
    invalid: { body: { reason: 'x' } },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers.location).toBeUndefined();
    },
  },
  {
    method: 'get',
    path: '/v1/trash/entries',
    url: '/v1/trash/entries?cursor=page-2&limit=25',
    call: 'listTrash',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ cursor: 'page-2', limit: 25 }],
    invalid: { url: '/v1/trash/entries?limit=0' },
  },
  {
    method: 'post',
    path: '/v1/trash/entries/{entryId}/restore',
    url: `/v1/trash/entries/${ENTRY_ID}/restore`,
    call: 'restoreTrashEntry',
    notRelayed: ['access.role-insufficient'],
    scope: 'tasks:write',
    status: 200,
    body: {},
    calledWith: [ENTRY_ID, {}],
    invalid: { body: { reason: 'x' } },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers.location).toBeUndefined();
    },
  },
  {
    method: 'delete',
    path: '/v1/trash/entries/{entryId}',
    url: `/v1/trash/entries/${ENTRY_ID}`,
    call: 'purgeTrashEntry',
    notRelayed: ['access.role-insufficient'],
    scope: 'tasks:write',
    status: 204,
    calledWith: [ENTRY_ID],
    invalid: { url: '/v1/trash/entries/not-a-uuid' },
    check: (response) => {
      expect(response.text).toBe('');
      expect(response.headers.etag).toBeUndefined();
    },
  },
  {
    method: 'post',
    path: '/v1/trash/empty',
    url: '/v1/trash/empty',
    call: 'emptyTrash',
    notRelayed: ['access.role-insufficient'],
    scope: 'tasks:write',
    status: 202,
    body: {},
    calledWith: [{}],
    invalid: { body: { reason: 'x' } },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers.location).toBeUndefined();
    },
  },
];

/**
 * Every case of every trash route.
 */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('routes of /v1/tasks/{taskKey}/trash and /v1/trash', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;

  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('exercises every status each trash route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it.each([
    ['post', '/v1/tasks/{taskKey}/trash', '/v1/tasks/cad-482/trash'],
    ['post', '/v1/trash/entries/{entryId}/restore', '/v1/trash/entries/not-a-uuid/restore'],
  ] as const)(
    'refuses %s %s with a path outside its contract before any call',
    async (method, path, url) => {
      await runRouteCase(application, identity, {
        name: 'path outside the contract',
        method,
        path,
        url,
        body: {},
        status: 400,
        code: 'request.invalid',
      });

      expect(application.task.trashTask).not.toHaveBeenCalled();
      expect(application.task.restoreTrashEntry).not.toHaveBeenCalled();
    },
  );

  it('answers the trash entry of a deleted task with its trash members', async () => {
    const response = await runRouteCase(application, identity, {
      name: 'trash entry members',
      method: 'post',
      path: '/v1/tasks/{taskKey}/trash',
      url: `/v1/tasks/${TASK_KEY}/trash`,
      body: {},
      status: 200,
    });

    expect(response.body).toEqual(responseExample('post', '/v1/tasks/{taskKey}/trash', 200));
    expect(response.body).toMatchObject({
      parentKey: null,
      subtaskCount: 3,
      list: { state: 'active' },
      trashedAt: '2026-11-08T15:00:00Z',
      trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
      purgeAt: '2026-12-08T15:00:00Z',
    });
  });

  it('relays the deletion without If-Match when the request has none', async () => {
    await runRouteCase(application, identity, {
      name: 'trash without If-Match',
      method: 'post',
      path: '/v1/tasks/{taskKey}/trash',
      url: `/v1/tasks/${TASK_KEY}/trash`,
      body: {},
      status: 200,
    });

    expect(application.task.trashTask).toHaveBeenCalledWith(TASK_KEY, {}, undefined);
  });

  it('relays 404 task.trashed with the entry in its details, without details.service', async () => {
    application.task.trashTask.mockRejectedValue(
      taskProblem(404, 'task.trashed', TASK_TRASHED_DETAILS),
    );

    const response = await runRouteCase(application, identity, {
      name: 'task already in the trash',
      method: 'post',
      path: '/v1/tasks/{taskKey}/trash',
      url: '/v1/tasks/CAD-452/trash',
      body: {},
      status: 404,
      code: 'task.trashed',
    });

    expect(response.body).toMatchObject({ title: 'Cette tâche a été supprimée' });
    expect((response.body as { details?: unknown }).details).toEqual(TASK_TRASHED_DETAILS);
  });

  it('relays 409 task.archived with details.key, without details.service', async () => {
    application.task.trashTask.mockRejectedValue(
      taskProblem(409, 'task.archived', { key: 'CAD-430' }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'archived task',
      method: 'post',
      path: '/v1/tasks/{taskKey}/trash',
      url: '/v1/tasks/CAD-430/trash',
      body: {},
      status: 409,
      code: 'task.archived',
    });

    expect((response.body as { details?: unknown }).details).toEqual({ key: 'CAD-430' });
  });

  it('relays 403 access.role-insufficient with the role of the caller', async () => {
    application.task.trashTask.mockRejectedValue(
      taskProblem(403, 'access.role-insufficient', { role: 'view', requiredRole: 'edit' }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'role insufficient',
      method: 'post',
      path: '/v1/tasks/{taskKey}/trash',
      url: `/v1/tasks/${TASK_KEY}/trash`,
      body: {},
      status: 403,
      code: 'access.role-insufficient',
    });

    expect((response.body as { details?: unknown }).details).toEqual({
      role: 'view',
      requiredRole: 'edit',
    });
  });

  it('lists the trash with its entries, their trash members and the total', async () => {
    const response = await runRouteCase(application, identity, {
      name: 'trash page members',
      method: 'get',
      path: '/v1/trash/entries',
      url: '/v1/trash/entries',
      status: 200,
    });

    expect(application.task.listTrash).toHaveBeenCalledWith({ limit: 50 });
    expect(response.body).toEqual(responseExample('get', '/v1/trash/entries', 200));
    expect(response.body).toMatchObject({
      nextCursor: null,
      total: 2,
      items: [
        {
          id: ENTRY_ID,
          trashedAt: '2026-11-06T16:20:00Z',
          trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
          purgeAt: '2026-12-06T16:20:00Z',
        },
        { purgeAt: '2026-11-26T10:05:00Z' },
      ],
    });
  });

  it('answers what a restoration brought back, its detached, listRestored and spaceRestored flags included', async () => {
    const restored = responseExample('post', '/v1/trash/entries/{entryId}/restore', 200) as Record<
      string,
      unknown
    >;
    application.task.restoreTrashEntry.mockResolvedValue({
      ...restored,
      subtaskCount: 2,
      detached: true,
      listRestored: true,
      spaceRestored: true,
    } as never);

    const response = await runRouteCase(application, identity, {
      name: 'restoration members',
      method: 'post',
      path: '/v1/trash/entries/{entryId}/restore',
      url: `/v1/trash/entries/${ENTRY_ID}/restore`,
      body: {},
      status: 200,
    });

    expect(response.body).toEqual({
      ...restored,
      subtaskCount: 2,
      detached: true,
      listRestored: true,
      spaceRestored: true,
    });
    expect(response.headers.etag).toBeUndefined();
  });

  it('answers the count of the entries the emptying took out', async () => {
    application.task.emptyTrash.mockResolvedValue({ entryCount: 12 });

    const response = await runRouteCase(application, identity, {
      name: 'emptying count',
      method: 'post',
      path: '/v1/trash/empty',
      url: '/v1/trash/empty',
      body: {},
      status: 202,
    });

    expect(response.body).toEqual({ entryCount: 12 });
  });
});
