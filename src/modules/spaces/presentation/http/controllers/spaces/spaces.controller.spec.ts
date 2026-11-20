import {
  CreateSpaceInternalResponse,
  GetSpaceInternalResponse,
  ListSpacesInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { internalExample } from '../../../../../../../tests/support/fake-task.js';
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
  {
    method: 'delete',
    path: '/v1/spaces/{spaceId}',
    url: `/v1/spaces/${SPACE_ID}`,
    call: 'deleteSpace',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"4"' },
    calledWith: [SPACE_ID, '"4"'],
    invalid: { url: '/v1/spaces/not-a-uuid' },
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
      expect(response.text).toBe('');
    },
  },
];

/**
 * The page of spaces task-service answers to a caller who reads "Produit" only and sees "Design"
 * through the grants of some of its lists only.
 */
const SHARED_SPACES = (() => {
  const page = internalExample(ListSpacesInternalResponse, 'get', '/v1/spaces');
  return ListSpacesInternalResponse.parse({
    ...page,
    items: page.items.map((space, index) => ({
      ...space,
      callerRole: index === 0 ? 'view' : null,
      callerCanManage: false,
    })),
  });
})();

/**
 * The space "Produit" as task-service answers it to a caller who may comment on it and does not
 * manage it.
 */
const COMMENTED_SPACE = GetSpaceInternalResponse.parse({
  ...internalExample(GetSpaceInternalResponse, 'get', '/v1/spaces/{spaceId}'),
  callerRole: 'comment',
  callerCanManage: false,
});

/**
 * A created space whose first list has its switch "Accès de l’organisation" off, as task-service
 * answers it.
 */
const CREATED_SPACE = (() => {
  const created = internalExample(CreateSpaceInternalResponse, 'post', '/v1/spaces', 201);
  return CreateSpaceInternalResponse.parse({
    ...created,
    firstList: { ...created.firstList, organizationAccess: false },
  });
})();

/**
 * Cases the matrix does not cover: the access members task-service answers survive to the public
 * answers, and a deletion without `If-Match`.
 */
const EXPLICIT_CASES: readonly RouteCase[] = [
  {
    name: 'GET /v1/spaces answers the callerRole and callerCanManage of each space',
    method: 'get',
    path: '/v1/spaces',
    url: '/v1/spaces',
    arrange: ({ task }) => task.listSpaces.mockResolvedValue(SHARED_SPACES),
    status: 200,
    check: (response) => {
      expect(response.body).toEqual(SHARED_SPACES);
      expect(response.body).toMatchObject({
        items: [
          { callerRole: 'view', callerCanManage: false },
          { callerRole: null, callerCanManage: false },
        ],
      });
    },
  },
  {
    name: 'GET /v1/spaces/{spaceId} answers the callerRole and callerCanManage of the space',
    method: 'get',
    path: '/v1/spaces/{spaceId}',
    url: `/v1/spaces/${SPACE_ID}`,
    arrange: ({ task }) => task.getSpace.mockResolvedValue(COMMENTED_SPACE),
    status: 200,
    check: (response) => {
      expect(response.body).toEqual(COMMENTED_SPACE);
      expect(response.body).toMatchObject({ callerRole: 'comment', callerCanManage: false });
    },
  },
  {
    name: 'POST /v1/spaces answers the access members of the space and of its first list',
    method: 'post',
    path: '/v1/spaces',
    url: '/v1/spaces',
    body: SPACE_CREATION,
    arrange: ({ task }) => task.createSpace.mockResolvedValue(CREATED_SPACE),
    status: 201,
    check: (response) => {
      expect(response.body).toEqual(CREATED_SPACE);
      expect(response.body).toMatchObject({
        space: { callerRole: 'edit', callerCanManage: true },
        firstList: {
          organizationAccess: false,
          archivedAt: null,
          archivedBy: null,
          callerRole: 'edit',
        },
      });
    },
  },
  {
    name: 'DELETE /v1/spaces/{spaceId} without If-Match calls task-service without one',
    method: 'delete',
    path: '/v1/spaces/{spaceId}',
    url: `/v1/spaces/${SPACE_ID}`,
    status: 204,
    check: (response, { task }) => {
      expect(task.deleteSpace).toHaveBeenCalledWith(SPACE_ID, undefined);
      expect(response.headers.etag).toBeUndefined();
      expect(response.text).toBe('');
    },
  },
];

/**
 * Every case of every space route.
 */
const CASES: readonly RouteCase[] = [...ROUTES.flatMap(taskRouteCases), ...EXPLICIT_CASES];

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
