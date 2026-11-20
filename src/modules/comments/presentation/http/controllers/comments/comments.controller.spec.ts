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
/** Comment identifier of the fixture. */
const COMMENT = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
/** Public operations exercised against their contracts. */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/comments',
    url: `/v1/tasks/${TASK}/comments?limit=20`,
    call: 'listTaskComments',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, { limit: 20 }],
    invalid: { url: `/v1/tasks/${TASK}/comments?limit=0` },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/comments',
    url: `/v1/tasks/${TASK}/comments`,
    call: 'createTaskComment',
    scope: 'tasks:write',
    status: 201,
    body: { body: 'hello' },
    headers: { 'Idempotency-Key': 'key' },
    calledWith: [TASK, { body: 'hello' }, 'key'],
    invalid: { body: { body: '' } },
    check: (response) => {
      expect(response.headers.location).toBe(`/v1/tasks/${TASK}/comments/${COMMENT}`);
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/comments/{commentId}',
    url: `/v1/tasks/${TASK}/comments/${COMMENT}`,
    call: 'getTaskComment',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, COMMENT],
    invalid: { url: `/v1/tasks/${TASK}/comments/invalid` },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'patch',
    path: '/v1/tasks/{taskKey}/comments/{commentId}',
    url: `/v1/tasks/${TASK}/comments/${COMMENT}`,
    call: 'updateTaskComment',
    scope: 'tasks:write',
    status: 200,
    body: { body: 'changed' },
    headers: { 'If-Match': '"1"' },
    calledWith: [TASK, COMMENT, { body: 'changed' }, '"1"'],
    invalid: { body: { body: '' } },
    check: (response) => {
      expect(response.headers.etag).toBe('"2"');
    },
  },
  {
    method: 'delete',
    path: '/v1/tasks/{taskKey}/comments/{commentId}',
    url: `/v1/tasks/${TASK}/comments/${COMMENT}`,
    call: 'deleteTaskComment',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"1"' },
    calledWith: [TASK, COMMENT, '"1"'],
    invalid: { url: `/v1/tasks/${TASK}/comments/invalid` },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/participants',
    url: `/v1/tasks/${TASK}/participants?limit=20`,
    call: 'listTaskParticipants',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK, { limit: 20 }],
    invalid: { url: `/v1/tasks/${TASK}/participants?limit=0` },
  },
];
/** Cases expanded from the public contract. */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('comment and participant routes', () => {
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
  it('requires If-Match before editing a comment', async () => {
    await runRouteCase(application, identity, {
      name: 'missing comment version',
      method: 'patch',
      path: '/v1/tasks/{taskKey}/comments/{commentId}',
      url: `/v1/tasks/${TASK}/comments/${COMMENT}`,
      body: { body: 'changed' },
      status: 400,
      code: 'request.invalid',
      check: (_response, fakes) => {
        expect(fakes.task.updateTaskComment).not.toHaveBeenCalled();
      },
    });
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
