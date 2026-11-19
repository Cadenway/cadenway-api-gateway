import type request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { taskProblem } from '../../../../../../../tests/support/fake-task.js';
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
 * Id of the private space "Direction" of the contract examples.
 */
const SPACE_ID = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e09';

/**
 * Id of the list "Sprint 14" of the contract examples.
 */
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';

/**
 * Id of the pending request for "Direction" of the contract examples.
 */
const ACCESS_REQUEST_ID = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';

/**
 * A request for access to a space, with a message.
 */
const SPACE_REQUEST = {
  spaceId: SPACE_ID,
  message: 'Je dois chiffrer la part outillage du budget 2027.',
};

/**
 * Checks that an answer carries no body.
 *
 * @param response - The response.
 */
function expectNoBody(response: request.Response): void {
  expect(response.text).toBe('');
}

/**
 * The access request routes of `openapi/public/access.yaml`.
 */
const ROUTES: readonly TaskRoute[] = [
  {
    method: 'post',
    path: '/v1/access-requests',
    url: '/v1/access-requests',
    call: 'createAccessRequest',
    scope: 'tasks:write',
    status: 202,
    body: SPACE_REQUEST,
    calledWith: [SPACE_REQUEST],
    invalid: { body: { spaceId: SPACE_ID, message: 'a'.repeat(501) } },
    check: expectNoBody,
  },
  {
    method: 'get',
    path: '/v1/access-requests',
    url: `/v1/access-requests?spaceId=${SPACE_ID}&listId=${LIST_ID}&cursor=c2&limit=10`,
    call: 'listAccessRequests',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ spaceId: SPACE_ID, listId: LIST_ID, cursor: 'c2', limit: 10 }],
    invalid: { url: '/v1/access-requests?spaceId=not-a-uuid' },
    check: (response) => {
      expect(response.body).toEqual(responseExample('get', '/v1/access-requests', 200));
    },
  },
  {
    method: 'post',
    path: '/v1/access-requests/{accessRequestId}/approval',
    url: `/v1/access-requests/${ACCESS_REQUEST_ID}/approval`,
    call: 'approveAccessRequest',
    scope: 'tasks:write',
    status: 200,
    body: { role: 'view' },
    calledWith: [ACCESS_REQUEST_ID, { role: 'view' }],
    invalid: { body: { role: 'owner' } },
    check: (response) => {
      expect(response.body).toEqual(
        responseExample('post', '/v1/access-requests/{accessRequestId}/approval', 200),
      );
    },
  },
  {
    method: 'post',
    path: '/v1/access-requests/{accessRequestId}/refusal',
    url: `/v1/access-requests/${ACCESS_REQUEST_ID}/refusal`,
    call: 'refuseAccessRequest',
    scope: 'tasks:write',
    status: 200,
    body: {},
    calledWith: [ACCESS_REQUEST_ID, {}],
    invalid: { body: { reason: 'Pas maintenant.' } },
    check: (response) => {
      expect(response.body).toEqual(
        responseExample('post', '/v1/access-requests/{accessRequestId}/refusal', 200),
      );
    },
  },
];

/**
 * Cases the matrix does not cover: a request for a task without a message, the gateway's own
 * `429` on the request, an undeclared `429`, the details of a relayed `409` and a refusal of a
 * request whose id is not a UUID.
 */
const EXPLICIT_CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/access-requests/{accessRequestId}/refusal refuses an id that is not a UUID before any call',
    method: 'post',
    path: '/v1/access-requests/{accessRequestId}/refusal',
    url: '/v1/access-requests/not-a-uuid/refusal',
    body: {},
    status: 400,
    code: 'request.invalid',
    check: (_response, { task }) => {
      expect(task.refuseAccessRequest).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/access-requests relays a request for a task without a message and answers 202 with no body',
    method: 'post',
    path: '/v1/access-requests',
    url: '/v1/access-requests',
    body: { taskKey: 'DIR-12', message: null },
    status: 202,
    check: (response, { task }) => {
      expect(task.createAccessRequest).toHaveBeenCalledWith({ taskKey: 'DIR-12', message: null });
      expectNoBody(response);
    },
  },
  {
    name: 'POST /v1/access-requests answers the gateway rate limit before any call',
    method: 'post',
    path: '/v1/access-requests',
    url: '/v1/access-requests',
    body: SPACE_REQUEST,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 4 }),
    status: 429,
    code: 'rate-limit.exceeded',
    check: (response, { task }) => {
      expect(response.headers['retry-after']).toBe('4');
      expect((response.body as { title?: unknown }).title).toBe(
        'Trop de requêtes : réessayez dans un instant.',
      );
      expect(task.createAccessRequest).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/access-requests answers 429 rate-limit.exceeded of task-service, which it does not relay, as 503',
    method: 'post',
    path: '/v1/access-requests',
    url: '/v1/access-requests',
    body: SPACE_REQUEST,
    arrange: ({ task }) =>
      task.createAccessRequest.mockRejectedValue(taskProblem(429, 'rate-limit.exceeded')),
    status: 503,
    code: 'upstream.failed',
    check: (response) => {
      expect(response.headers['retry-after']).toBeUndefined();
    },
  },
  {
    name: 'POST /v1/access-requests/{accessRequestId}/approval relays 409 access-request.already-decided with details.state',
    method: 'post',
    path: '/v1/access-requests/{accessRequestId}/approval',
    url: `/v1/access-requests/${ACCESS_REQUEST_ID}/approval`,
    body: { role: 'edit' },
    arrange: ({ task }) =>
      task.approveAccessRequest.mockRejectedValue(
        taskProblem(409, 'access-request.already-decided', { state: 'refused' }),
      ),
    status: 409,
    code: 'access-request.already-decided',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Cette demande d’accès a déjà reçu une réponse.',
        status: 409,
        code: 'access-request.already-decided',
        details: { state: 'refused' },
      });
    },
  },
  {
    name: 'POST /v1/access-requests/{accessRequestId}/refusal answers 422 access.grantee-invalid, which it does not declare, as 503',
    method: 'post',
    path: '/v1/access-requests/{accessRequestId}/refusal',
    url: `/v1/access-requests/${ACCESS_REQUEST_ID}/refusal`,
    body: {},
    arrange: ({ task }) =>
      task.refuseAccessRequest.mockRejectedValue(taskProblem(422, 'access.grantee-invalid')),
    status: 503,
    code: 'upstream.failed',
  },
];

/**
 * Every case of every access request route.
 */
const CASES: readonly RouteCase[] = [...ROUTES.flatMap(taskRouteCases), ...EXPLICIT_CASES];

/**
 * Builds the case of a `429 access-request.limit-reached` of task-service, relayed with its
 * French title, `details.nextAvailableAt` and `Retry-After`.
 *
 * @param nextAvailableAt - When the oldest request counted leaves the hour.
 * @param retryAfter - The `Retry-After` the gateway answers.
 * @returns The case.
 */
function limitReached(nextAvailableAt: string, retryAfter: string): RouteCase {
  return {
    name: 'POST /v1/access-requests relays 429 access-request.limit-reached',
    method: 'post',
    path: '/v1/access-requests',
    url: '/v1/access-requests',
    body: SPACE_REQUEST,
    arrange: ({ task }) =>
      task.createAccessRequest.mockRejectedValue(
        taskProblem(429, 'access-request.limit-reached', { nextAvailableAt }),
      ),
    status: 429,
    code: 'access-request.limit-reached',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Trop de demandes d’accès : réessayez plus tard.',
        status: 429,
        code: 'access-request.limit-reached',
        details: { nextAvailableAt },
      });
      expect(response.headers['retry-after']).toBe(retryAfter);
    },
  };
}

describe('routes of /v1/access-requests', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;

  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('exercises every status each access request route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('relays 429 access-request.limit-reached with Retry-After rounded up to the whole second', async () => {
    const now: number = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    await runRouteCase(
      application,
      identity,
      limitReached(new Date(now + 2300).toISOString(), '3'),
    );
  });

  it('relays 429 access-request.limit-reached with Retry-After 1 when nextAvailableAt has passed', async () => {
    const now: number = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    await runRouteCase(
      application,
      identity,
      limitReached(new Date(now - 5000).toISOString(), '1'),
    );
  });
});
