import { afterAll, afterEach, beforeAll, describe, it, vi, expect } from 'vitest';
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

/** Resource identifier from the contract. */
const ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
/** Route exercised against the public contract. */
const ROUTE: TaskRoute = {
  method: 'post',
  path: '/v1/lists/{listId}/duplicate',
  url: `/v1/lists/${ID}/duplicate`,
  call: 'duplicateList',
  scope: 'tasks:write',
  status: 201,
  body: {},
  headers: { 'If-Match': '"2"', 'Idempotency-Key': 'copy-key' },
  calledWith: [ID, {}, '"2"', 'copy-key'],
  invalid: { body: { extra: true } },
  check: (response) => {
    expect(response.headers.etag).toBe(
      `"${String((response.body as { list: { version: number } }).list.version)}"`,
    );
    expect(response.headers.location).toBe(
      `/v1/lists/${(response.body as { list: { id: string } }).list.id}`,
    );
  },
};
/** Cases expanded from the contract. */
const CASES: readonly RouteCase[] = taskRouteCases(ROUTE);

describe('duplicate-list route', () => {
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
