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

/** Favorite identifier of the contract example. */
const FAVORITE = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02';
/** List identifier of the contract example. */
const LIST = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
/** Public favorite operations. */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/me/favorites',
    url: '/v1/me/favorites?cursor=page&limit=20',
    call: 'listFavorites',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ cursor: 'page', limit: 20 }],
    invalid: { url: '/v1/me/favorites?limit=0' },
  },
  {
    method: 'post',
    path: '/v1/me/favorites',
    url: '/v1/me/favorites',
    call: 'createFavorite',
    scope: 'tasks:write',
    status: 201,
    body: { kind: 'list', targetId: LIST },
    headers: { 'Idempotency-Key': 'favorite-key' },
    calledWith: [{ kind: 'list', targetId: LIST }, 'favorite-key'],
    invalid: { body: { kind: 'list', targetId: 'invalid' } },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
      expect(response.headers.location).toBe(`/v1/me/favorites/${FAVORITE}`);
    },
  },
  {
    method: 'get',
    path: '/v1/me/favorites/{favoriteId}',
    url: `/v1/me/favorites/${FAVORITE}`,
    call: 'getFavorite',
    scope: 'tasks:read',
    status: 200,
    calledWith: [FAVORITE],
    invalid: { url: '/v1/me/favorites/invalid' },
    check: (response) => {
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'delete',
    path: '/v1/me/favorites/{favoriteId}',
    url: `/v1/me/favorites/${FAVORITE}`,
    call: 'deleteFavorite',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"1"' },
    calledWith: [FAVORITE, '"1"'],
    invalid: { url: '/v1/me/favorites/invalid' },
  },
];
/** Cases expanded from the public contract. */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('favorite routes', () => {
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
