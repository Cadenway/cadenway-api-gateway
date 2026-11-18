import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
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
 * A valid creation of a sprint, every member with a default given.
 */
const SPRINT_CREATION = {
  name: 'Sprint 15',
  icon: 'rocket',
  color: 'violet',
  sprint: { startDate: '2026-11-23', endDate: '2026-12-04', goal: 'Livrer le SSO' },
};

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
    body: { name: 'Sprint 14 bis', sprint: null },
    headers: { 'If-Match': '"7"' },
    calledWith: [LIST_ID, { name: 'Sprint 14 bis', sprint: null }, '"7"'],
    invalid: { body: { color: 'turquoise' } },
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
    invalid: { url: `/v1/lists/${LIST_ID}/activity?kind=comment` },
  },
];

/**
 * Every case of every list route.
 */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

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
