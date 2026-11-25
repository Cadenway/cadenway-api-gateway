import {
  GetListInternalResponse,
  ListListsInternalResponse,
  UpdateListInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { internalExample } from '../../../../../../../tests/support/fake-task.js';
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
 * Id of the space "Produit" of the contract examples.
 */
const SPACE_ID = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';

/**
 * Id of the list "Sprint 14" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';

/**
 * A valid creation of a sprint, every member with a default given, the switch "Accès de
 * l’organisation" off.
 */
const SPRINT_CREATION = {
  name: 'Sprint 15',
  icon: 'rocket',
  color: 'violet',
  sprint: { startDate: '2026-11-23', endDate: '2026-12-04', goal: 'Livrer le SSO' },
  organizationAccess: false,
};

/**
 * A valid change of a list that also turns its switch "Accès de l’organisation" off.
 */
const LIST_PATCH = { name: 'Sprint 14 bis', sprint: null, organizationAccess: false };

/**
 * The routes of `openapi/public/lists.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'post',
    path: '/v1/spaces/{spaceId}/lists',
    url: `/v1/spaces/${SPACE_ID}/lists`,
    call: 'createList',
    scope: 'tasks:write',
    status: 201,
    body: SPRINT_CREATION,
    headers: { 'Idempotency-Key': 'sprint-15' },
    calledWith: [SPACE_ID, SPRINT_CREATION, 'sprint-15'],
    invalid: { body: { name: '' } },
    check: (response) => {
      const list = response.body as { id: string; version: number };
      expect(response.headers.location).toBe(`/v1/lists/${list.id}`);
      expect(response.headers.etag).toBe(`"${String(list.version)}"`);
    },
  },
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/lists',
    url: `/v1/spaces/${SPACE_ID}/lists?limit=50`,
    call: 'listLists',
    scope: 'tasks:read',
    status: 200,
    calledWith: [SPACE_ID, { limit: 50 }],
    invalid: { url: `/v1/spaces/${SPACE_ID}/lists?limit=0` },
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}',
    url: `/v1/lists/${LIST_ID}`,
    call: 'getList',
    scope: 'tasks:read',
    status: 200,
    calledWith: [LIST_ID],
    invalid: { url: '/v1/lists/not-a-uuid' },
  },
  {
    method: 'patch',
    path: '/v1/lists/{listId}',
    url: `/v1/lists/${LIST_ID}`,
    call: 'updateList',
    scope: 'tasks:write',
    status: 200,
    body: LIST_PATCH,
    headers: { 'If-Match': '"7"' },
    calledWith: [LIST_ID, LIST_PATCH, '"7"'],
    invalid: { body: { color: 'turquoise' } },
  },
  {
    method: 'delete',
    path: '/v1/lists/{listId}',
    url: `/v1/lists/${LIST_ID}`,
    call: 'deleteList',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"7"' },
    calledWith: [LIST_ID, '"7"'],
    invalid: { url: '/v1/lists/not-a-uuid' },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.text).toBe('');
    },
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}/counts',
    url: `/v1/lists/${LIST_ID}/counts?today=2026-11-18`,
    call: 'getListCounts',
    scope: 'tasks:read',
    status: 200,
    calledWith: [LIST_ID, { today: '2026-11-18' }],
    invalid: { url: `/v1/lists/${LIST_ID}/counts?today=18/11/2026` },
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}/activity',
    url: `/v1/lists/${LIST_ID}/activity?kind=status,assign&actorId=019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30&limit=25`,
    call: 'listListActivity',
    scope: 'tasks:read',
    status: 200,
    calledWith: [
      LIST_ID,
      { kind: ['status', 'assign'], actorId: ['019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30'], limit: 25 },
    ],
    invalid: { url: `/v1/lists/${LIST_ID}/activity?kind=unknown` },
  },
  {
    method: 'query',
    path: '/v1/lists/{listId}/activity',
    url: `/v1/lists/${LIST_ID}/activity`,
    call: 'queryListListActivity',
    scope: 'tasks:read',
    status: 200,
    body: { kind: ['status', 'assign'], limit: 25 },
    calledWith: [LIST_ID, { kind: ['status', 'assign'], limit: 25 }],
    invalid: { body: { kind: ['unknown'] } },
  },
];

/**
 * The member who archived "Sprint 14" in the archived list the fake answers.
 */
const ARCHIVER = { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' };

/**
 * "Sprint 14" archived, its switch off, as task-service answers it to a caller who reads it only.
 */
const ARCHIVED_LIST = GetListInternalResponse.parse({
  ...internalExample(GetListInternalResponse, 'get', '/v1/lists/{listId}'),
  organizationAccess: false,
  archivedAt: '2026-11-18T08:30:00Z',
  archivedBy: ARCHIVER,
  callerRole: 'view',
});

/**
 * The lists of "Produit" as task-service answers them, each with the members of the access of the
 * caller and of the archives.
 */
const ACCESS_LISTS = (() => {
  const page = internalExample(ListListsInternalResponse, 'get', '/v1/spaces/{spaceId}/lists');
  return ListListsInternalResponse.parse({
    ...page,
    items: page.items.map((list, index) => ({
      ...list,
      organizationAccess: index !== 0,
      archivedAt: null,
      archivedBy: null,
      callerRole: index === 0 ? 'comment' : 'edit',
    })),
  });
})();

/**
 * "Sprint 14" after its switch was turned off, as task-service answers the change.
 */
const CLOSED_LIST = UpdateListInternalResponse.parse({
  ...internalExample(UpdateListInternalResponse, 'patch', '/v1/lists/{listId}'),
  organizationAccess: false,
});

/**
 * Cases the matrix does not cover: the access and archive members task-service answers survive to
 * the public answers, and a deletion without `If-Match`.
 */
const EXPLICIT_CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/spaces/{spaceId}/lists answers the access and archive members of the list',
    method: 'post',
    path: '/v1/spaces/{spaceId}/lists',
    url: `/v1/spaces/${SPACE_ID}/lists`,
    body: SPRINT_CREATION,
    status: 201,
    check: (response, { task }) => {
      expect(task.createList).toHaveBeenCalledWith(SPACE_ID, SPRINT_CREATION, undefined);
      expect(response.body).toMatchObject({
        organizationAccess: true,
        archivedAt: null,
        archivedBy: null,
        callerRole: 'edit',
      });
    },
  },
  {
    name: 'GET /v1/lists/{listId} answers an archived list with who archived it and when',
    method: 'get',
    path: '/v1/lists/{listId}',
    url: `/v1/lists/${LIST_ID}`,
    arrange: ({ task }) => task.getList.mockResolvedValue(ARCHIVED_LIST),
    status: 200,
    check: (response) => {
      expect(response.body).toEqual(ARCHIVED_LIST);
      expect(response.body).toMatchObject({
        organizationAccess: false,
        archivedAt: '2026-11-18T08:30:00Z',
        archivedBy: ARCHIVER,
        callerRole: 'view',
      });
      expect(response.headers.etag).toBe(`"${String(ARCHIVED_LIST.version)}"`);
    },
  },
  {
    name: 'GET /v1/spaces/{spaceId}/lists answers the access and archive members of each list',
    method: 'get',
    path: '/v1/spaces/{spaceId}/lists',
    url: `/v1/spaces/${SPACE_ID}/lists`,
    arrange: ({ task }) => task.listLists.mockResolvedValue(ACCESS_LISTS),
    status: 200,
    check: (response) => {
      expect(response.body).toEqual(ACCESS_LISTS);
      expect((response.body as { items: unknown[] }).items[0]).toMatchObject({
        organizationAccess: false,
        archivedAt: null,
        archivedBy: null,
        callerRole: 'comment',
      });
    },
  },
  {
    name: 'PATCH /v1/lists/{listId} answers the switch task-service turned off',
    method: 'patch',
    path: '/v1/lists/{listId}',
    url: `/v1/lists/${LIST_ID}`,
    body: { organizationAccess: false },
    arrange: ({ task }) => task.updateList.mockResolvedValue(CLOSED_LIST),
    status: 200,
    check: (response, { task }) => {
      expect(task.updateList).toHaveBeenCalledWith(
        LIST_ID,
        { organizationAccess: false },
        undefined,
      );
      expect(response.body).toEqual(CLOSED_LIST);
      expect(response.body).toMatchObject({ organizationAccess: false, callerRole: 'edit' });
    },
  },
  {
    name: 'DELETE /v1/lists/{listId} without If-Match calls task-service without one',
    method: 'delete',
    path: '/v1/lists/{listId}',
    url: `/v1/lists/${LIST_ID}`,
    status: 204,
    check: (response, { task }) => {
      expect(task.deleteList).toHaveBeenCalledWith(LIST_ID, undefined);
      expect(response.headers.etag).toBeUndefined();
      expect(response.text).toBe('');
    },
  },
];

/**
 * Every case of every list route.
 */
const CASES: readonly RouteCase[] = [...ROUTES.flatMap(taskRouteCases), ...EXPLICIT_CASES];

describe('routes of /v1/spaces/{spaceId}/lists and /v1/lists', () => {
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

  it('exercises every status each list route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
