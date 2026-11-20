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

/** Anchor key of the fixture. */
const TASK = 'CAD-482';
/** Edge identifier from the contract example. */
const EDGE = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
/** Public dependency operations. */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/dependencies',
    url: `/v1/tasks/${TASK}/dependencies?limit=20`,
    call: 'listTaskDependencies',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, { limit: 20 }],
    invalid: { url: `/v1/tasks/${TASK}/dependencies?limit=0` },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/dependencies',
    url: `/v1/tasks/${TASK}/dependencies`,
    call: 'createTaskDependency',
    scope: 'tasks:write',
    status: 201,
    body: { otherTaskKey: 'CAD-483', direction: 'blocks' },
    headers: { 'If-Match': '"12"', 'Idempotency-Key': 'edge-key' },
    calledWith: [TASK, { otherTaskKey: 'CAD-483', direction: 'blocks' }, '"12"', 'edge-key'],
    invalid: { body: { otherTaskKey: 'bad', direction: 'blocks' } },
    check: (response) => {
      expect(response.headers.etag).toBe('"13"');
      expect(response.headers.location).toBe(`/v1/tasks/${TASK}/dependencies/${EDGE}`);
    },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/dependencies/{dependencyId}',
    url: `/v1/tasks/${TASK}/dependencies/${EDGE}`,
    call: 'getTaskDependency',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, EDGE],
    invalid: { url: `/v1/tasks/${TASK}/dependencies/invalid` },
  },
  {
    method: 'delete',
    path: '/v1/tasks/{taskKey}/dependencies/{dependencyId}',
    url: `/v1/tasks/${TASK}/dependencies/${EDGE}`,
    call: 'deleteTaskDependency',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"12"' },
    calledWith: [TASK, EDGE, '"12"'],
    invalid: { url: `/v1/tasks/${TASK}/dependencies/invalid` },
    check: (response) => {
      expect(response.headers.etag).toBe('"13"');
    },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/dependency-candidates',
    url: `/v1/tasks/${TASK}/dependency-candidates?direction=blocks&search=login&limit=20`,
    call: 'listDependencyCandidates',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, { direction: 'blocks', search: 'login', limit: 20 }],
    invalid: { url: `/v1/tasks/${TASK}/dependency-candidates?direction=invalid` },
  },
];
/** Cases expanded from the contract. */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('dependency routes', () => {
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
