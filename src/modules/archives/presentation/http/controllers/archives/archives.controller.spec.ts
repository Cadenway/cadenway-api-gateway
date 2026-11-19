import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { taskProblem } from '../../../../../../../tests/support/fake-task.js';
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
 * Id of the sprint "Sprint 13" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f10';

/**
 * Key of the task "Ancienne page des tarifs" of the contract examples.
 */
const TASK_KEY = 'CAD-430';

/**
 * Who archived "Sprint 13" in the contract examples, Camille Martin.
 */
const LIST_ARCHIVER = { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' };

/**
 * Who archived "CAD-430" in the contract examples.
 */
const TASK_ARCHIVER = { type: 'user', id: '019a5f3c-a0b1-7c2d-9e3f-5a6b7c8d9e32' };

/**
 * The details of `404 task.trashed` in the contract example.
 */
const TRASHED_DETAILS = {
  key: 'CAD-452',
  name: 'Ancien écran de connexion',
  entryId: '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01',
  rootKey: 'CAD-452',
  trashedAt: '2026-11-06T16:20:00Z',
  trashedBy: LIST_ARCHIVER,
  purgeAt: '2026-12-06T16:20:00Z',
};

/**
 * The members of a list or task an action answers that the checks read.
 */
interface ArchivedResource {
  // #region Properties
  /** Version of the resource, also its `ETag`. */
  readonly version: number;

  /** When the resource was archived, `null` when it is not. */
  readonly archivedAt: string | null;

  /** Who archived the resource, `null` when it is not archived. */
  readonly archivedBy: unknown;
  // #endregion
}

/**
 * The routes of `openapi/public/archives.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'post',
    path: '/v1/lists/{listId}/archive',
    url: `/v1/lists/${LIST_ID}/archive`,
    call: 'archiveList',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"3"' },
    calledWith: [LIST_ID, {}, '"3"'],
    invalid: { body: { reason: 'Sprint terminé' } },
    check: (response) => {
      const list = response.body as ArchivedResource;
      expect(response.headers.etag).toBe('"4"');
      expect(list).toMatchObject({
        version: 4,
        archivedAt: '2026-11-03T09:00:00Z',
        archivedBy: LIST_ARCHIVER,
      });
    },
  },
  {
    method: 'post',
    path: '/v1/lists/{listId}/unarchive',
    url: `/v1/lists/${LIST_ID}/unarchive`,
    call: 'unarchiveList',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"4"' },
    calledWith: [LIST_ID, {}, '"4"'],
    invalid: { url: '/v1/lists/not-a-uuid/unarchive' },
    check: (response) => {
      const list = response.body as ArchivedResource;
      expect(response.headers.etag).toBe('"5"');
      expect(list).toMatchObject({ version: 5, archivedAt: null, archivedBy: null });
    },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/archive',
    url: `/v1/tasks/${TASK_KEY}/archive`,
    call: 'archiveTask',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"6"' },
    calledWith: [TASK_KEY, {}, '"6"'],
    invalid: { body: { subtasks: false } },
    check: (response) => {
      const task = response.body as ArchivedResource;
      expect(response.headers.etag).toBe('"7"');
      expect(task).toMatchObject({
        version: 7,
        archivedAt: '2026-11-05T11:30:00Z',
        archivedBy: TASK_ARCHIVER,
      });
    },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/unarchive',
    url: `/v1/tasks/${TASK_KEY}/unarchive`,
    call: 'unarchiveTask',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"7"' },
    calledWith: [TASK_KEY, {}, '"7"'],
    invalid: { url: '/v1/tasks/cad-430/unarchive' },
    check: (response) => {
      const task = response.body as ArchivedResource;
      expect(response.headers.etag).toBe('"8"');
      expect(task).toMatchObject({ version: 8, archivedAt: null, archivedBy: null });
    },
  },
  {
    method: 'get',
    path: '/v1/archives/lists',
    url: '/v1/archives/lists?cursor=c2Vjb25kLXBhZ2U&limit=20',
    call: 'listArchivedLists',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ cursor: 'c2Vjb25kLXBhZ2U', limit: 20 }],
    invalid: { url: '/v1/archives/lists?limit=0' },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.body).toEqual({
        items: [
          {
            list: expect.objectContaining({
              id: LIST_ID,
              archivedAt: '2026-11-03T09:00:00Z',
              archivedBy: LIST_ARCHIVER,
              callerRole: 'edit',
            }) as unknown,
            taskCount: 14,
          },
        ],
        nextCursor: null,
        total: 1,
      });
    },
  },
  {
    method: 'get',
    path: '/v1/archives/tasks',
    url: '/v1/archives/tasks?limit=20',
    call: 'listArchivedTasks',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ limit: 20 }],
    invalid: { url: '/v1/archives/tasks?limit=101' },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.body).toEqual({
        items: [
          {
            task: expect.objectContaining({ key: TASK_KEY, version: 7 }) as unknown,
            list: {
              id: '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12',
              spaceId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01',
              name: 'Sprint 14',
              state: 'active',
            },
            subtaskCount: 0,
            archivedAt: '2026-11-05T11:30:00Z',
            archivedBy: TASK_ARCHIVER,
          },
        ],
        nextCursor: null,
        total: 1,
      });
    },
  },
];

/**
 * Every case of every archives route.
 */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('routes of the archives', () => {
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

  it('exercises every status each archives route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('archives a list without If-Match, relaying no version to check', async () => {
    await runRouteCase(application, identity, {
      name: 'archive without If-Match',
      method: 'post',
      path: '/v1/lists/{listId}/archive',
      url: `/v1/lists/${LIST_ID}/archive`,
      body: {},
      status: 200,
    });

    expect(application.task.archiveList).toHaveBeenCalledWith(LIST_ID, {}, undefined);
  });

  it('restores a task without If-Match, relaying no version to check', async () => {
    await runRouteCase(application, identity, {
      name: 'restore without If-Match',
      method: 'post',
      path: '/v1/tasks/{taskKey}/unarchive',
      url: `/v1/tasks/${TASK_KEY}/unarchive`,
      body: {},
      status: 200,
    });

    expect(application.task.unarchiveTask).toHaveBeenCalledWith(TASK_KEY, {}, undefined);
  });

  it('relays the details of 404 task.trashed, without the internal service', async () => {
    application.task.archiveTask.mockRejectedValue(
      taskProblem(404, 'task.trashed', TRASHED_DETAILS),
    );

    const response = await runRouteCase(application, identity, {
      name: 'archive of a trashed task',
      method: 'post',
      path: '/v1/tasks/{taskKey}/archive',
      url: '/v1/tasks/CAD-452/archive',
      body: {},
      status: 404,
      code: 'task.trashed',
    });

    expect(response.body).toMatchObject({
      title: 'Cette tâche a été supprimée',
      details: TRASHED_DETAILS,
    });
  });

  it('relays the roles of 403 access.role-insufficient', async () => {
    application.task.unarchiveList.mockRejectedValue(
      taskProblem(403, 'access.role-insufficient', { role: 'view', requiredRole: 'edit' }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'restore with view only',
      method: 'post',
      path: '/v1/lists/{listId}/unarchive',
      url: `/v1/lists/${LIST_ID}/unarchive`,
      body: {},
      status: 403,
      code: 'access.role-insufficient',
    });

    expect(response.body).toMatchObject({
      title: 'Il faut le droit « Peut modifier » pour cette action.',
      details: { role: 'view', requiredRole: 'edit' },
    });
  });

  it('relays the current version of 412 request.version-mismatch', async () => {
    application.task.archiveList.mockRejectedValue(
      taskProblem(412, 'request.version-mismatch', { version: 4 }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'archive from a stale version',
      method: 'post',
      path: '/v1/lists/{listId}/archive',
      url: `/v1/lists/${LIST_ID}/archive`,
      body: {},
      headers: { 'If-Match': '"2"' },
      status: 412,
      code: 'request.version-mismatch',
    });

    expect(response.body).toMatchObject({ details: { version: 4 } });
  });

  it('reads the archived lists with the default page size of the contract', async () => {
    await runRouteCase(application, identity, {
      name: 'archived lists without a query',
      method: 'get',
      path: '/v1/archives/lists',
      url: '/v1/archives/lists',
      status: 200,
    });

    expect(application.task.listArchivedLists).toHaveBeenCalledWith({ limit: 50 });
  });

  it('answers 503 upstream.failed when task-service answers an archived task the public contract cannot carry', async () => {
    application.task.listArchivedTasks.mockResolvedValue({
      items: [{ task: { key: 'not a key' } }],
      nextCursor: null,
      total: 1,
    } as never);

    const response = await runRouteCase(application, identity, {
      name: 'archived task outside the public contract',
      method: 'get',
      path: '/v1/archives/tasks',
      url: '/v1/archives/tasks',
      status: 503,
      code: 'upstream.failed',
    });

    expect((response.body as { details?: unknown }).details).toEqual({ service: 'task-service' });
  });
});
