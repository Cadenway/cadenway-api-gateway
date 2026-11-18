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
 * A valid creation of a space, every member with a default given.
 */
const SPACE_CREATION = {
  name: 'Ressources humaines',
  prefix: 'RH',
  description: null,
  icon: 'users',
  color: 'lagon',
  visibility: 'organization',
};

/**
 * The routes of `openapi/public/spaces.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/spaces',
    url: '/v1/spaces?limit=20&cursor=c1',
    call: 'listSpaces',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ limit: 20, cursor: 'c1' }],
    invalid: { url: '/v1/spaces?limit=0' },
  },
  {
    method: 'post',
    path: '/v1/spaces',
    url: '/v1/spaces',
    call: 'createSpace',
    scope: 'tasks:write',
    status: 201,
    body: SPACE_CREATION,
    headers: { 'Idempotency-Key': 'creation-1' },
    calledWith: [SPACE_CREATION, 'creation-1'],
    invalid: { headers: { 'Idempotency-Key': 'k'.repeat(256) } },
    check: (response) => {
      const space = (response.body as { space: { id: string; version: number } }).space;
      expect(response.headers.location).toBe(`/v1/spaces/${space.id}`);
      expect(response.headers.etag).toBe(`"${String(space.version)}"`);
    },
  },
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}',
    url: `/v1/spaces/${SPACE_ID}`,
    call: 'getSpace',
    scope: 'tasks:read',
    status: 200,
    calledWith: [SPACE_ID],
    invalid: { url: '/v1/spaces/not-a-uuid' },
    check: (response) => {
      expect(response.headers.etag).toBe(
        `"${String((response.body as { version: number }).version)}"`,
      );
    },
  },
  {
    method: 'patch',
    path: '/v1/spaces/{spaceId}',
    url: `/v1/spaces/${SPACE_ID}`,
    call: 'updateSpace',
    scope: 'tasks:write',
    status: 200,
    body: { name: 'Produit et design', description: null },
    headers: { 'If-Match': '"4"' },
    calledWith: [SPACE_ID, { name: 'Produit et design', description: null }, '"4"'],
    invalid: { body: { prefix: 'lowercase' } },
  },
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/overview',
    url: `/v1/spaces/${SPACE_ID}/overview?today=2026-11-18&limit=10`,
    call: 'getSpaceOverview',
    scope: 'tasks:read',
    status: 200,
    calledWith: [SPACE_ID, { today: '2026-11-18', limit: 10 }],
    invalid: { url: `/v1/spaces/${SPACE_ID}/overview` },
  },
];

/**
 * Every case of every space route.
 */
const CASES: readonly RouteCase[] = ROUTES.flatMap(taskRouteCases);

describe('routes of /v1/spaces', () => {
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

  it('exercises every status each space route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
