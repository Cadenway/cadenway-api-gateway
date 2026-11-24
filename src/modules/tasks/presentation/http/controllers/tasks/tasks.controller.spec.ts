import { ClientRequest } from 'node:http';

import {
  GetTaskDetailInternalResponse,
  GetTaskInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  ADDED_CHECKLIST_ITEM_ID,
  internalExample,
  taskDetailCore,
  taskProblem,
  UNASSIGNED_VERSION,
} from '../../../../../../../tests/support/fake-task.js';
import { expectPublicResponse } from '../../../../../../../tests/support/public-contract.js';
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
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';

/**
 * Id of the list "Sprint 14" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';

/**
 * Key of the task "Refondre l’écran de connexion SSO" of the contract examples.
 */
const TASK_KEY = 'CAD-482';

/**
 * Id of an account, Inès Robert of the contract examples.
 */
const INES_ID = '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31';

/**
 * Id of a checklist item.
 */
const ITEM_ID = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e10';

/**
 * A valid creation of a task, every member with a default given.
 */
const TASK_CREATION = {
  name: 'Ajouter la connexion par lien magique',
  description: null,
  status: 'todo',
  priority: 'haute',
  assigneeIds: [CAMILLE.id],
  dueDate: '2026-11-16',
  labels: ['Auth', 'Front'],
  subtasks: [{ name: 'Envoyer le lien par e-mail' }],
};

/**
 * A valid creation of a subtask, every member with a default given.
 */
const SUBTASK_CREATION = {
  name: 'Tester la connexion avec Okta',
  status: 'todo',
  priority: 'moyenne',
  labels: [],
};

/**
 * `details` of `404 task.trashed`, as the example of `TaskNotFound` in the contract writes them.
 */
const TRASHED_DETAILS = {
  key: 'CAD-452',
  name: 'Ancien écran de connexion',
  entryId: '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01',
  rootKey: 'CAD-452',
  trashedAt: '2026-11-06T16:20:00Z',
  trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
  purgeAt: '2026-12-06T16:20:00Z',
};

/**
 * When and by whom the archived task of the cases was archived.
 */
const ARCHIVED = {
  archivedAt: '2026-11-05T10:00:00Z',
  archivedBy: { type: 'user', id: CAMILLE.id },
};

/**
 * Checks that the answer carries the `ETag` of the version of the task it holds.
 *
 * @param response - The answer.
 * @param response.body - Its body, a task.
 * @param response.headers - Its headers.
 */
function expectTaskEtag(response: {
  body: unknown;
  headers: Record<string, string | undefined>;
}): void {
  expect(response.headers.etag).toBe(`"${String((response.body as { version: number }).version)}"`);
}

/**
 * The routes of `openapi/public/tasks.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/lists/{listId}/tasks',
    url: `/v1/lists/${LIST_ID}/tasks?status=progress,review&priority=haute&assignee=me,none&label=Auth&search=sso&dueFrom=2026-11-01&dueTo=2026-11-30&level=all&sort=-dueDate&limit=10`,
    call: 'listTasks',
    scope: 'tasks:read',
    status: 200,
    calledWith: [
      LIST_ID,
      {
        status: ['progress', 'review'],
        priority: ['haute'],
        assignee: ['me', 'none'],
        label: ['Auth'],
        search: 'sso',
        dueFrom: '2026-11-01',
        dueTo: '2026-11-30',
        level: 'all',
        sort: '-dueDate',
        limit: 10,
      },
    ],
    invalid: { url: `/v1/lists/${LIST_ID}/tasks?assignee=someone` },
  },
  {
    method: 'post',
    path: '/v1/lists/{listId}/tasks',
    url: `/v1/lists/${LIST_ID}/tasks`,
    call: 'createTask',
    scope: 'tasks:write',
    status: 201,
    body: TASK_CREATION,
    headers: { 'Idempotency-Key': 'task-creation-1' },
    calledWith: [LIST_ID, TASK_CREATION, 'task-creation-1'],
    invalid: { body: { ...TASK_CREATION, name: '' } },
    check: (response) => {
      expect(response.headers.location).toBe(`/v1/tasks/${(response.body as { key: string }).key}`);
      expectTaskEtag(response);
    },
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}/task-groups',
    url: `/v1/lists/${LIST_ID}/task-groups?groupBy=status&assignee=me&limit=20`,
    call: 'countTaskGroups',
    scope: 'tasks:read',
    status: 200,
    calledWith: [LIST_ID, { groupBy: 'status', assignee: ['me'], level: 'roots', limit: 20 }],
    invalid: { url: `/v1/lists/${LIST_ID}/task-groups` },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}',
    url: `/v1/tasks/${TASK_KEY}`,
    call: 'getTask',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK_KEY],
    invalid: { url: '/v1/tasks/cad-482' },
    check: expectTaskEtag,
  },
  {
    method: 'patch',
    path: '/v1/tasks/{taskKey}',
    url: `/v1/tasks/${TASK_KEY}`,
    call: 'updateTask',
    scope: 'tasks:write',
    status: 200,
    body: { status: 'cancelled', cancelReason: 'duplicate', dueDate: null },
    headers: { 'If-Match': '"12"' },
    calledWith: [
      TASK_KEY,
      { status: 'cancelled', cancelReason: 'duplicate', dueDate: null },
      '"12"',
    ],
    invalid: { body: { estimateMinutes: 0 } },
    check: expectTaskEtag,
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/detail',
    url: `/v1/tasks/${TASK_KEY}/detail`,
    call: 'getTaskDetail',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK_KEY],
    invalid: { url: '/v1/tasks/CAD-0/detail' },
    check: (response) => {
      expect(response.body).toEqual({
        ...taskDetailCore(),
        comments: { items: [], nextCursor: null, total: 0 },
        partial: [],
      });
      expect(response.headers.etag).toBe(`"${String(taskDetailCore().task.version)}"`);
      expect(response.headers['cache-control']).toBe('private, no-store');
    },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/subtasks',
    url: `/v1/tasks/${TASK_KEY}/subtasks?limit=25`,
    call: 'listSubtasks',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK_KEY, { limit: 25 }],
    invalid: { url: `/v1/tasks/${TASK_KEY}/subtasks?limit=many` },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/subtasks',
    url: `/v1/tasks/${TASK_KEY}/subtasks`,
    call: 'createSubtask',
    scope: 'tasks:write',
    status: 201,
    body: SUBTASK_CREATION,
    headers: { 'Idempotency-Key': 'subtask-1' },
    calledWith: [TASK_KEY, SUBTASK_CREATION, 'subtask-1'],
    invalid: { headers: { 'Idempotency-Key': '' } },
    check: (response) => {
      expect(response.headers.location).toBe(`/v1/tasks/${(response.body as { key: string }).key}`);
    },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/checklist-items',
    url: `/v1/tasks/${TASK_KEY}/checklist-items`,
    call: 'addChecklistItem',
    scope: 'tasks:write',
    status: 201,
    body: { text: 'Relire les messages d’erreur' },
    calledWith: [TASK_KEY, { text: 'Relire les messages d’erreur' }, undefined],
    invalid: { body: { text: 'x'.repeat(301) } },
    check: (response) => {
      const task = response.body as { key: string };
      expect(response.headers.location).toBe(
        `/v1/tasks/${task.key}/checklist-items/${ADDED_CHECKLIST_ITEM_ID}`,
      );
      expectTaskEtag(response);
    },
  },
  {
    method: 'patch',
    path: '/v1/tasks/{taskKey}/checklist-items/{checklistItemId}',
    url: `/v1/tasks/${TASK_KEY}/checklist-items/${ITEM_ID}`,
    call: 'updateChecklistItem',
    scope: 'tasks:write',
    status: 200,
    body: { done: true },
    calledWith: [TASK_KEY, ITEM_ID, { done: true }, undefined],
    invalid: { body: { done: 'yes' } },
  },
  {
    method: 'put',
    path: '/v1/tasks/{taskKey}/assignees/{userId}',
    url: `/v1/tasks/${TASK_KEY}/assignees/${INES_ID}`,
    call: 'assignTask',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK_KEY, INES_ID, '"12"'],
    invalid: { body: { role: 'reviewer' } },
    check: expectTaskEtag,
  },
  {
    method: 'delete',
    path: '/v1/tasks/{taskKey}/assignees/{userId}',
    url: `/v1/tasks/${TASK_KEY}/assignees/${INES_ID}`,
    call: 'unassignTask',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK_KEY, INES_ID, '"12"'],
    invalid: { url: `/v1/tasks/${TASK_KEY}/assignees/ines` },
    check: (response) => {
      expect(response.headers.etag).toBe(`"${String(UNASSIGNED_VERSION)}"`);
      expect(response.text).toBe('');
    },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/labels/add',
    url: `/v1/tasks/${TASK_KEY}/labels/add`,
    call: 'addTaskLabel',
    scope: 'tasks:write',
    status: 200,
    body: { name: 'Sécurité' },
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK_KEY, { name: 'Sécurité' }, '"12"'],
    invalid: { body: { name: 'x'.repeat(33) } },
    check: expectTaskEtag,
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/labels/remove',
    url: `/v1/tasks/${TASK_KEY}/labels/remove`,
    call: 'removeTaskLabel',
    scope: 'tasks:write',
    status: 200,
    body: { name: 'Front' },
    calledWith: [TASK_KEY, { name: 'Front' }, undefined],
    invalid: { body: {} },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/activity',
    url: `/v1/tasks/${TASK_KEY}/activity?kind=status,due&limit=30`,
    call: 'listTaskActivity',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK_KEY, { kind: ['status', 'due'], limit: 30 }],
    invalid: { url: `/v1/tasks/${TASK_KEY}/activity?unknown=1` },
  },
  {
    method: 'get',
    path: '/v1/labels',
    url: '/v1/labels?search=au&limit=20',
    call: 'listLabels',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ search: 'au', limit: 20 }],
    invalid: { url: '/v1/labels?limit=0' },
  },
  {
    method: 'get',
    path: '/v1/me/tasks',
    url: '/v1/me/tasks?state=closed&limit=50',
    call: 'listMyTasks',
    scope: 'tasks:read',
    status: 200,
    calledWith: [CAMILLE.id, { state: 'closed', limit: 50 }],
    invalid: { url: '/v1/me/tasks?state=archived' },
  },
  {
    method: 'get',
    path: '/v1/me/home',
    url: '/v1/me/home?today=2026-11-18',
    call: 'getHome',
    scope: 'tasks:read',
    status: 200,
    calledWith: [CAMILLE.id, { today: '2026-11-18' }],
    invalid: { url: '/v1/me/home' },
  },
];

/**
 * Every case of every task route.
 */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

/** The routes that accept an organization precondition. */
const ORGANIZATION_PRECONDITION_ROUTES = ROUTES.filter((route) =>
  ['getTask', 'getTaskDetail', 'updateTask'].includes(route.call),
);

describe('routes of the tasks, the labels, "Mes tâches" and "Accueil"', () => {
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

  it('exercises every status each task route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  describe.each(ORGANIZATION_PRECONDITION_ROUTES)('$method $path', (route) => {
    it('accepts a matching If-Organization-Match without changing the task version precondition', async () => {
      await runRouteCase(application, identity, {
        ...route,
        name: 'matching organization precondition',
        headers: {
          ...route.headers,
          'If-Organization-Match': ATELIER_NORD_ID.toUpperCase(),
          ...(route.method === 'get'
            ? { 'If-None-Match': `"${String(taskDetailCore().task.version)}"` }
            : {}),
        },
        status: 200,
      });

      expect(application.task[route.call]).toHaveBeenCalledWith(...route.calledWith);
    });

    it.each(['', '019a5f3c-8d2e-4c4a-9b1f-3e5d7a9c1b2f'])(
      'refuses a malformed If-Organization-Match (%j) before calling Task',
      async (header) => {
        const response = await runRouteCase(application, identity, {
          name: 'malformed organization precondition',
          method: route.method,
          path: route.path,
          url: route.url,
          body: route.body,
          headers: { ...route.headers, 'If-Organization-Match': header },
          status: 400,
          code: 'request.invalid',
        });

        expect(response.body).toMatchObject({
          details: { issues: [{ in: 'header', path: 'If-Organization-Match' }] },
        });
        expect(application.task[route.call]).not.toHaveBeenCalled();
      },
    );

    it('refuses two identical If-Organization-Match fields before calling Task', async () => {
      const pending = request(application.server)
        [route.method as Exclude<typeof route.method, 'query'>](route.url)
        .set({
          ...route.headers,
          Cookie: `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`,
          Origin: ALLOWED_ORIGIN,
        })
        .on('request', (outgoing: request.Test) => {
          if (!(outgoing.req instanceof ClientRequest)) {
            throw new Error('Expected an HTTP/1.1 request.');
          }
          outgoing.req.setHeader('If-Organization-Match', [ATELIER_NORD_ID, ATELIER_NORD_ID]);
        });
      const response =
        route.body === undefined ? await pending : await pending.send(route.body as object);

      expectPublicResponse(route.method, route.path, response);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'request.invalid',
        details: { issues: [{ in: 'header', path: 'If-Organization-Match' }] },
      });
      expect(application.task[route.call]).not.toHaveBeenCalled();
    });
  });

  it('returns a fresh task detail for a matching cache validator without an organization precondition', async () => {
    const etag = `"${String(taskDetailCore().task.version)}"`;
    const response = await runRouteCase(application, identity, {
      name: 'task detail with a matching cache validator',
      method: 'get',
      path: '/v1/tasks/{taskKey}/detail',
      url: `/v1/tasks/${TASK_KEY}/detail`,
      headers: { 'If-None-Match': etag },
      status: 200,
    });

    expect(response.headers.etag).toBe(etag);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(application.task.getTaskDetail).toHaveBeenCalledWith(TASK_KEY);
  });

  it('forwards the milestone filter to list and group queries', async () => {
    await runRouteCase(application, identity, {
      name: 'milestone task list',
      method: 'get',
      path: '/v1/lists/{listId}/tasks',
      url: `/v1/lists/${LIST_ID}/tasks?milestone=true`,
      status: 200,
    });
    expect(application.task.listTasks).toHaveBeenCalledWith(
      LIST_ID,
      expect.objectContaining({ milestone: true }),
    );
    await runRouteCase(application, identity, {
      name: 'ordinary task groups',
      method: 'get',
      path: '/v1/lists/{listId}/task-groups',
      url: `/v1/lists/${LIST_ID}/task-groups?groupBy=status&milestone=false`,
      status: 200,
    });
    expect(application.task.countTaskGroups).toHaveBeenCalledWith(
      LIST_ID,
      expect.objectContaining({ milestone: false }),
    );
  });

  it('answers 503 upstream.failed when task-service answers a detail the public contract cannot carry', async () => {
    application.task.getTaskDetail.mockResolvedValue({
      ...taskDetailCore(),
      subtasks: [{ key: 'not a key' }],
    } as never);

    const response = await runRouteCase(application, identity, {
      name: 'detail outside the public contract',
      method: 'get',
      path: '/v1/tasks/{taskKey}/detail',
      url: `/v1/tasks/${TASK_KEY}/detail`,
      status: 503,
      code: 'upstream.failed',
    });

    expect((response.body as { details?: unknown }).details).toEqual({ service: 'task-service' });
  });

  it('answers the 404 task.trashed of task-service on the detail with its details, never a 503 or a partial detail', async () => {
    application.task.getTaskDetail.mockRejectedValue(
      taskProblem(404, 'task.trashed', TRASHED_DETAILS),
    );

    const response = await runRouteCase(application, identity, {
      name: 'detail of a task in the trash',
      method: 'get',
      path: '/v1/tasks/{taskKey}/detail',
      url: '/v1/tasks/CAD-452/detail',
      status: 404,
      code: 'task.trashed',
    });

    expect(response.body).toMatchObject({
      title: 'Cette tâche a été supprimée',
      status: 404,
      code: 'task.trashed',
      details: TRASHED_DETAILS,
    });
    expect((response.body as { details: Record<string, unknown> }).details).not.toHaveProperty(
      'service',
    );
    expect(response.body).not.toHaveProperty('partial');
    expect(application.task.getTaskDetail).toHaveBeenCalledWith('CAD-452');
  });

  it('relays 409 task.archived of a change with the key of the archived task', async () => {
    application.task.updateTask.mockRejectedValue(
      taskProblem(409, 'task.archived', { key: TASK_KEY }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'change of an archived task',
      method: 'patch',
      path: '/v1/tasks/{taskKey}',
      url: `/v1/tasks/${TASK_KEY}`,
      body: { priority: 'basse' },
      headers: { 'If-Match': '"12"' },
      status: 409,
      code: 'task.archived',
    });

    expect((response.body as { details?: unknown }).details).toEqual({ key: TASK_KEY });
  });

  it.each([
    {
      method: 'patch' as const,
      path: '/v1/tasks/{taskKey}/checklist-items/{checklistItemId}',
      url: `/v1/tasks/${TASK_KEY}/checklist-items/${ITEM_ID}`,
      body: { done: true },
      call: 'updateChecklistItem' as const,
      ifMatch: '',
    },
    {
      method: 'post' as const,
      path: '/v1/tasks/{taskKey}/labels/remove',
      url: `/v1/tasks/${TASK_KEY}/labels/remove`,
      body: { name: 'Front' },
      call: 'removeTaskLabel' as const,
      ifMatch: ' \t ',
    },
  ])(
    'refuses a blank If-Match on $method $path before any call',
    async ({ method, path, url, body, call, ifMatch }) => {
      const response = await runRouteCase(application, identity, {
        name: `blank If-Match on ${path}`,
        method,
        path,
        url,
        body,
        headers: { 'If-Match': ifMatch },
        status: 400,
        code: 'request.invalid',
      });

      expect(response.body).toMatchObject({
        details: { issues: [{ in: 'header', path: 'If-Match' }] },
      });
      expect(application.task[call]).not.toHaveBeenCalled();
    },
  );

  it('reads an archived task with archivedAt and archivedBy', async () => {
    application.task.getTask.mockResolvedValue(
      GetTaskInternalResponse.parse({
        ...internalExample(GetTaskInternalResponse, 'get', '/v1/tasks/{taskKey}'),
        ...ARCHIVED,
      }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'archived task',
      method: 'get',
      path: '/v1/tasks/{taskKey}',
      url: `/v1/tasks/${TASK_KEY}`,
      status: 200,
      check: expectTaskEtag,
    });

    expect(response.body).toMatchObject(ARCHIVED);
  });

  it('reads the detail of an archived task with archivedAt, archivedBy and the callerRole of its list', async () => {
    const core = taskDetailCore();
    application.task.getTaskDetail.mockResolvedValue(
      GetTaskDetailInternalResponse.parse({
        ...core,
        task: { ...core.task, ...ARCHIVED },
        list: { ...core.list, callerRole: 'comment' },
      }),
    );

    const response = await runRouteCase(application, identity, {
      name: 'detail of an archived task',
      method: 'get',
      path: '/v1/tasks/{taskKey}/detail',
      url: `/v1/tasks/${TASK_KEY}/detail`,
      status: 200,
    });

    expect(response.body).toMatchObject({
      task: ARCHIVED,
      list: { callerRole: 'comment' },
      partial: [],
    });
  });

  it('drops a member of an answer the public contract does not declare', async () => {
    application.task.getTask.mockResolvedValue({
      ...(await application.task.getTask.getMockImplementation()?.(TASK_KEY)),
      internalScore: 42,
    } as never);

    const response = await runRouteCase(application, identity, {
      name: 'member outside the public contract',
      method: 'get',
      path: '/v1/tasks/{taskKey}',
      url: `/v1/tasks/${TASK_KEY}`,
      status: 200,
    });

    expect(response.body).not.toHaveProperty('internalScore');
  });

  it('reads "Mes tâches" for the user of a personal API token, never one the request names', async () => {
    await runRouteCase(application, identity, {
      name: 'my tasks with a token',
      method: 'get',
      path: '/v1/me/tasks',
      url: '/v1/me/tasks',
      credential: 'tasks-token',
      status: 200,
    });

    expect(application.task.listMyTasks).toHaveBeenCalledWith(CAMILLE.id, {
      state: 'open',
      limit: expect.any(Number) as number,
    });
  });
});
