import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { taskProblem } from '../../../../../../../tests/support/fake-task.js';
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

/** A valid action with a per-task precondition. */
const BODY = {
  selection: [{ taskKey: 'CAD-482', version: 12 }],
  action: { type: 'status', status: 'done' },
};
/** Bulk route exercised against its public contract. */
const ROUTE: TaskRoute = {
  method: 'post',
  path: '/v1/tasks/bulk-actions',
  url: '/v1/tasks/bulk-actions',
  call: 'executeBulkTaskAction',
  scope: 'tasks:write',
  status: 200,
  body: BODY,
  headers: { 'Idempotency-Key': 'bulk-key' },
  calledWith: [BODY, 'bulk-key'],
  invalid: { body: { selection: [], action: { type: 'status', status: 'done' } } },
};
/** Cases expanded from the public contract. */
const CASES: readonly RouteCase[] = taskRouteCases(ROUTE);

describe('bulk task action route', () => {
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
  it.each(['task.not-found', 'task.trashed', 'list.not-found', 'organization.not-found'])(
    'does not disclose hidden details for bulk 404 %s',
    async (code) => {
      const response = await runRouteCase(application, identity, {
        name: 'bulk hidden 404',
        method: 'post',
        path: '/v1/tasks/bulk-actions',
        url: '/v1/tasks/bulk-actions',
        body: BODY,
        status: 404,
        code,
        arrange: ({ task }) =>
          task.executeBulkTaskAction.mockRejectedValue(
            taskProblem(404, code, { key: 'HIDDEN-12', userId: 'hidden' }),
          ),
      });
      expect(response.body).not.toHaveProperty('details');
    },
  );

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
