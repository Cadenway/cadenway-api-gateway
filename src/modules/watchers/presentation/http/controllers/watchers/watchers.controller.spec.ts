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

/** Task key of the fixture. */
const TASK = 'CAD-482';
/** Watcher account from the contract example. */
const USER = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
/** Public watcher operations. */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/watchers',
    url: `/v1/tasks/${TASK}/watchers?limit=20`,
    call: 'listTaskWatchers',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, { limit: 20 }],
    invalid: { url: `/v1/tasks/${TASK}/watchers?limit=0` },
  },
  {
    method: 'put',
    path: '/v1/tasks/{taskKey}/watchers/{userId}',
    url: `/v1/tasks/${TASK}/watchers/${USER}`,
    call: 'followTaskWatcher',
    scope: 'tasks:write',
    status: 200,
    body: {},
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK, USER, {}, '"12"'],
    invalid: { body: { extra: true } },
    check: (response) => {
      expect(response.headers.etag).toBe('"13"');
    },
  },
  {
    method: 'delete',
    path: '/v1/tasks/{taskKey}/watchers/{userId}',
    url: `/v1/tasks/${TASK}/watchers/${USER}`,
    call: 'unfollowTaskWatcher',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK, USER, '"12"'],
    invalid: { url: `/v1/tasks/${TASK}/watchers/invalid` },
    check: (response) => {
      expect(response.headers.etag).toBe('"13"');
    },
  },
];
/** Cases expanded from the contract. */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('watcher routes', () => {
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
  it('covers every declared status', () => {
    expectEveryDeclaredStatus(CASES);
  });
  it.each(CASES.map((routeCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
