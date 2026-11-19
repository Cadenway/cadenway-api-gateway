import type request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  LIST_GRANT_REMOVED_VERSION,
  LIST_GRANT_VERSION,
  SPACE_GRANT_REMOVED_VERSION,
  SPACE_GRANT_VERSION,
  taskProblem,
} from '../../../../../../../tests/support/fake-task.js';
import { responseExample } from '../../../../../../../tests/support/public-contract.js';
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
 * Id of the list "Sprint 14" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';

/**
 * Account of Hugo Dubois, given access in the contract examples.
 */
const USER_ID = '019a5f3c-a0b1-7c2d-9e3f-5a6b7c8d9e32';

/**
 * Checks that a removal answers `204` with no body and the given version as its `ETag`.
 *
 * @param version - Version of the space or the list after the change.
 * @returns The check.
 */
function removedWith(version: number): (response: request.Response) => void {
  return (response) => {
    expect(response.headers.etag).toBe(`"${String(version)}"`);
    expect(response.text).toBe('');
  };
}

/**
 * The routes of the grants of `openapi/public/access.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/grants',
    url: `/v1/spaces/${SPACE_ID}/grants?cursor=c2&limit=20`,
    call: 'listSpaceGrants',
    scope: 'tasks:read',
    status: 200,
    calledWith: [SPACE_ID, { cursor: 'c2', limit: 20 }],
    invalid: { url: `/v1/spaces/${SPACE_ID}/grants?limit=0` },
    check: (response) => {
      expect(response.body).toEqual(responseExample('get', '/v1/spaces/{spaceId}/grants', 200));
    },
  },
  {
    method: 'put',
    path: '/v1/spaces/{spaceId}/grants/{userId}',
    url: `/v1/spaces/${SPACE_ID}/grants/${USER_ID}`,
    call: 'setSpaceGrant',
    scope: 'tasks:write',
    status: 200,
    body: { role: 'edit' },
    headers: { 'If-Match': '"7"' },
    calledWith: [SPACE_ID, USER_ID, { role: 'edit' }, '"7"'],
    invalid: { body: { role: 'owner' } },
    check: (response) => {
      expect(response.headers.etag).toBe(`"${String(SPACE_GRANT_VERSION)}"`);
      expect(response.body).toEqual(
        responseExample('put', '/v1/spaces/{spaceId}/grants/{userId}', 200),
      );
    },
  },
  {
    method: 'delete',
    path: '/v1/spaces/{spaceId}/grants/{userId}',
    url: `/v1/spaces/${SPACE_ID}/grants/${USER_ID}`,
    call: 'removeSpaceGrant',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"8"' },
    calledWith: [SPACE_ID, USER_ID, '"8"'],
    invalid: { url: `/v1/spaces/${SPACE_ID}/grants/not-a-uuid` },
    check: removedWith(SPACE_GRANT_REMOVED_VERSION),
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}/grants',
    url: `/v1/lists/${LIST_ID}/grants`,
    call: 'listListGrants',
    scope: 'tasks:read',
    status: 200,
    calledWith: [LIST_ID, { limit: 50 }],
    invalid: { url: `/v1/lists/${LIST_ID}/grants?limit=101` },
    check: (response) => {
      expect(response.body).toEqual(responseExample('get', '/v1/lists/{listId}/grants', 200));
    },
  },
  {
    method: 'put',
    path: '/v1/lists/{listId}/grants/{userId}',
    url: `/v1/lists/${LIST_ID}/grants/${USER_ID}`,
    call: 'setListGrant',
    scope: 'tasks:write',
    status: 200,
    body: { role: 'comment' },
    headers: { 'If-Match': '"3"' },
    calledWith: [LIST_ID, USER_ID, { role: 'comment' }, '"3"'],
    invalid: { body: {} },
    check: (response) => {
      expect(response.headers.etag).toBe(`"${String(LIST_GRANT_VERSION)}"`);
      expect(response.body).toEqual(
        responseExample('put', '/v1/lists/{listId}/grants/{userId}', 200),
      );
    },
  },
  {
    method: 'delete',
    path: '/v1/lists/{listId}/grants/{userId}',
    url: `/v1/lists/${LIST_ID}/grants/${USER_ID}`,
    call: 'removeListGrant',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"4"' },
    calledWith: [LIST_ID, USER_ID, '"4"'],
    invalid: { url: `/v1/lists/not-a-uuid/grants/${USER_ID}` },
    check: removedWith(LIST_GRANT_REMOVED_VERSION),
  },
];

/**
 * Cases the matrix does not cover: a change without `If-Match`, the details of a relayed refusal,
 * and the `403` of the other resource, which a route does not relay.
 */
const EXPLICIT_CASES: readonly RouteCase[] = [
  {
    name: 'PUT /v1/spaces/{spaceId}/grants/{userId} relays no If-Match when the request has none',
    method: 'put',
    path: '/v1/spaces/{spaceId}/grants/{userId}',
    url: `/v1/spaces/${SPACE_ID}/grants/${USER_ID}`,
    body: { role: 'view' },
    status: 200,
    check: (response, { task }) => {
      expect(task.setSpaceGrant).toHaveBeenCalledWith(
        SPACE_ID,
        USER_ID,
        { role: 'view' },
        undefined,
      );
      expect(response.headers.etag).toBe(`"${String(SPACE_GRANT_VERSION)}"`);
    },
  },
  {
    name: 'DELETE /v1/lists/{listId}/grants/{userId} relays no If-Match when the request has none',
    method: 'delete',
    path: '/v1/lists/{listId}/grants/{userId}',
    url: `/v1/lists/${LIST_ID}/grants/${USER_ID}`,
    status: 204,
    check: (response, { task }) => {
      expect(task.removeListGrant).toHaveBeenCalledWith(LIST_ID, USER_ID, undefined);
      removedWith(LIST_GRANT_REMOVED_VERSION)(response);
    },
  },
  {
    name: 'PUT /v1/spaces/{spaceId}/grants/{userId} relays 422 access.grantee-invalid with its French title and details.userId',
    method: 'put',
    path: '/v1/spaces/{spaceId}/grants/{userId}',
    url: `/v1/spaces/${SPACE_ID}/grants/${USER_ID}`,
    body: { role: 'edit' },
    arrange: ({ task }) =>
      task.setSpaceGrant.mockRejectedValue(
        taskProblem(422, 'access.grantee-invalid', { userId: USER_ID }),
      ),
    status: 422,
    code: 'access.grantee-invalid',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Cette personne ne fait pas partie de l’organisation : invitez-la d’abord.',
        status: 422,
        code: 'access.grantee-invalid',
        details: { userId: USER_ID },
      });
    },
  },
  {
    name: 'PUT /v1/lists/{listId}/grants/{userId} relays 403 access.role-insufficient with details.role and details.requiredRole',
    method: 'put',
    path: '/v1/lists/{listId}/grants/{userId}',
    url: `/v1/lists/${LIST_ID}/grants/${USER_ID}`,
    body: { role: 'edit' },
    arrange: ({ task }) =>
      task.setListGrant.mockRejectedValue(
        taskProblem(403, 'access.role-insufficient', { role: 'view', requiredRole: 'edit' }),
      ),
    status: 403,
    code: 'access.role-insufficient',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Il faut le droit « Peut modifier » pour cette action.',
        status: 403,
        code: 'access.role-insufficient',
        details: { role: 'view', requiredRole: 'edit' },
      });
    },
  },
  {
    name: 'PUT /v1/spaces/{spaceId}/grants/{userId} answers 403 access.role-insufficient, which it does not declare, as 503',
    method: 'put',
    path: '/v1/spaces/{spaceId}/grants/{userId}',
    url: `/v1/spaces/${SPACE_ID}/grants/${USER_ID}`,
    body: { role: 'edit' },
    arrange: ({ task }) =>
      task.setSpaceGrant.mockRejectedValue(taskProblem(403, 'access.role-insufficient')),
    status: 503,
    code: 'upstream.failed',
    check: (response) => {
      expect(response.headers.etag).toBeUndefined();
    },
  },
  {
    name: 'DELETE /v1/lists/{listId}/grants/{userId} answers 403 space.manage-forbidden, which it does not declare, as 503',
    method: 'delete',
    path: '/v1/lists/{listId}/grants/{userId}',
    url: `/v1/lists/${LIST_ID}/grants/${USER_ID}`,
    arrange: ({ task }) =>
      task.removeListGrant.mockRejectedValue(taskProblem(403, 'space.manage-forbidden')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'DELETE /v1/spaces/{spaceId}/grants/{userId} answers 422 access.grantee-invalid, which it does not declare, as 503',
    method: 'delete',
    path: '/v1/spaces/{spaceId}/grants/{userId}',
    url: `/v1/spaces/${SPACE_ID}/grants/${USER_ID}`,
    arrange: ({ task }) =>
      task.removeSpaceGrant.mockRejectedValue(taskProblem(422, 'access.grantee-invalid')),
    status: 503,
    code: 'upstream.failed',
  },
];

/**
 * Every case of every grant route.
 */
const CASES: readonly RouteCase[] = [...ROUTES.flatMap(taskRouteCases), ...EXPLICIT_CASES];

describe('routes of /v1/spaces/{spaceId}/grants and /v1/lists/{listId}/grants', () => {
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

  it('exercises every status each grant route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
