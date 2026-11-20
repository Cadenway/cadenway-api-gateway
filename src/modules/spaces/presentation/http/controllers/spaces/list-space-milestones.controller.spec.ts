import { afterAll, afterEach, beforeAll, describe, it, vi } from 'vitest';
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
const ID = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
/** Route exercised against the public contract. */
const ROUTE: TaskRoute = {
  method: 'get',
  path: '/v1/spaces/{spaceId}/milestones',
  url: `/v1/spaces/${ID}/milestones?cursor=page&limit=20`,
  call: 'listSpaceMilestones',
  scope: 'tasks:read',
  status: 200,
  calledWith: [ID, { cursor: 'page', limit: 20 }],
  invalid: { url: `/v1/spaces/${ID}/milestones?limit=0` },
};
/** Cases expanded from the contract. */
const CASES: readonly RouteCase[] = taskRouteCases(ROUTE);

describe('list-space-milestones route', () => {
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
