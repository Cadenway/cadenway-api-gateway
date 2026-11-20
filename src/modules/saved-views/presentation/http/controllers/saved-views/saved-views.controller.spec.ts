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

/** List identifier of the fixture. */
const LIST = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
/** View identifier of the fixture. */
const VIEW = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
/** Duplicate identifier of the fixture. */
const COPY = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f03';
/** Valid creation input. */
const CREATION = {
  name: 'View',
  configuration: { layout: 'list', filters: {}, sort: 'dueDate', groupBy: null },
};
/** Saved view operations exercised against their contracts. */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/lists/{listId}/saved-views',
    url: `/v1/lists/${LIST}/saved-views?cursor=page&limit=20`,
    call: 'listSavedViews',
    scope: 'tasks:read',
    status: 200,
    calledWith: [LIST, { cursor: 'page', limit: 20 }],
    invalid: { url: `/v1/lists/${LIST}/saved-views?limit=0` },
  },
  {
    method: 'post',
    path: '/v1/lists/{listId}/saved-views',
    url: `/v1/lists/${LIST}/saved-views`,
    call: 'createSavedView',
    scope: 'tasks:write',
    status: 201,
    body: CREATION,
    headers: { 'Idempotency-Key': 'view-key' },
    calledWith: [LIST, CREATION, 'view-key'],
    invalid: { body: { name: '' } },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
      expect(response.headers.location).toBe(`/v1/lists/${LIST}/saved-views/${VIEW}`);
    },
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}/saved-views/{viewId}',
    url: `/v1/lists/${LIST}/saved-views/${VIEW}`,
    call: 'getSavedView',
    scope: 'tasks:read',
    status: 200,
    calledWith: [LIST, VIEW],
    invalid: { url: `/v1/lists/${LIST}/saved-views/invalid` },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'patch',
    path: '/v1/lists/{listId}/saved-views/{viewId}',
    url: `/v1/lists/${LIST}/saved-views/${VIEW}`,
    call: 'updateSavedView',
    scope: 'tasks:write',
    status: 200,
    body: { name: 'Changed' },
    headers: { 'If-Match': '"1"' },
    calledWith: [LIST, VIEW, { name: 'Changed' }, '"1"'],
    invalid: { body: { name: '' } },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'delete',
    path: '/v1/lists/{listId}/saved-views/{viewId}',
    url: `/v1/lists/${LIST}/saved-views/${VIEW}`,
    call: 'deleteSavedView',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"1"' },
    calledWith: [LIST, VIEW, '"1"'],
    invalid: { url: `/v1/lists/${LIST}/saved-views/invalid` },
  },
  {
    method: 'post',
    path: '/v1/lists/{listId}/saved-views/{viewId}/duplicate',
    url: `/v1/lists/${LIST}/saved-views/${VIEW}/duplicate`,
    call: 'duplicateSavedView',
    scope: 'tasks:write',
    status: 201,
    body: {},
    headers: { 'If-Match': '"1"', 'Idempotency-Key': 'copy-key' },
    calledWith: [LIST, VIEW, {}, '"1"', 'copy-key'],
    invalid: { body: { extra: true } },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
      expect(response.headers.location).toBe(`/v1/lists/${LIST}/saved-views/${COPY}`);
    },
  },
];
/** Cases expanded from the public contract. */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('saved view routes', () => {
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
  it('uses the returned list id in creation and duplication locations', async () => {
    const created = await runRouteCase(application, identity, {
      name: 'create with uppercase list id',
      method: 'post',
      path: '/v1/lists/{listId}/saved-views',
      url: `/v1/lists/${LIST.toUpperCase()}/saved-views`,
      body: CREATION,
      status: 201,
    });
    expect(created.headers.location).toBe(`/v1/lists/${LIST}/saved-views/${VIEW}`);
    const duplicated = await runRouteCase(application, identity, {
      name: 'duplicate with uppercase list id',
      method: 'post',
      path: '/v1/lists/{listId}/saved-views/{viewId}/duplicate',
      url: `/v1/lists/${LIST.toUpperCase()}/saved-views/${VIEW}/duplicate`,
      body: {},
      status: 201,
    });
    expect(duplicated.headers.location).toBe(`/v1/lists/${LIST}/saved-views/${COPY}`);
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
