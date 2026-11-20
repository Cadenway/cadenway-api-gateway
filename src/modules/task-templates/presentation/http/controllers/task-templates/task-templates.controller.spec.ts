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

/** Space and template identifiers from the contract example. */
const SPACE = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
/** Template identifier from the contract example. */
const TEMPLATE = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
/** Public task-template operations. */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/task-templates',
    url: `/v1/spaces/${SPACE}/task-templates?cursor=page&limit=20`,
    call: 'listTaskTemplates',
    scope: 'tasks:read',
    status: 200,
    calledWith: [SPACE, { cursor: 'page', limit: 20 }],
    invalid: { url: `/v1/spaces/${SPACE}/task-templates?limit=0` },
  },
  {
    method: 'post',
    path: '/v1/spaces/{spaceId}/task-templates',
    url: `/v1/spaces/${SPACE}/task-templates`,
    call: 'createTaskTemplate',
    scope: 'tasks:write',
    status: 201,
    body: { sourceTaskKey: 'CAD-482', name: 'Template' },
    headers: { 'Idempotency-Key': 'template-key' },
    calledWith: [SPACE, { sourceTaskKey: 'CAD-482', name: 'Template' }, 'template-key'],
    invalid: { body: { sourceTaskKey: 'bad', name: 'Template' } },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
      expect(response.headers.location).toBe(`/v1/spaces/${SPACE}/task-templates/${TEMPLATE}`);
    },
  },
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/task-templates/{templateId}',
    url: `/v1/spaces/${SPACE}/task-templates/${TEMPLATE}`,
    call: 'getTaskTemplate',
    scope: 'tasks:read',
    status: 200,
    calledWith: [SPACE, TEMPLATE],
    invalid: { url: `/v1/spaces/${SPACE}/task-templates/invalid` },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'delete',
    path: '/v1/spaces/{spaceId}/task-templates/{templateId}',
    url: `/v1/spaces/${SPACE}/task-templates/${TEMPLATE}`,
    call: 'deleteTaskTemplate',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"1"' },
    calledWith: [SPACE, TEMPLATE, '"1"'],
    invalid: { url: `/v1/spaces/${SPACE}/task-templates/invalid` },
  },
];
/** Cases expanded from the contract. */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('task template routes', () => {
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
  it('uses the returned space id in the creation location', async () => {
    const response = await runRouteCase(application, identity, {
      name: 'uppercase space id',
      method: 'post',
      path: '/v1/spaces/{spaceId}/task-templates',
      url: `/v1/spaces/${SPACE.toUpperCase()}/task-templates`,
      body: { sourceTaskKey: 'CAD-482', name: 'Template' },
      status: 201,
    });
    expect(response.headers.location).toBe(`/v1/spaces/${SPACE}/task-templates/${TEMPLATE}`);
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
