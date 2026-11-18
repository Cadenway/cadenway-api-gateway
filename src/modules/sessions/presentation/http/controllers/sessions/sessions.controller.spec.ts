import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_SESSION,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
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

/**
 * Constant SESSION_ID
 *
 * @description
 * Id of the session of the default credential of the route cases, Camille in Atelier Nord.
 *
 * @type {string}
 */
const SESSION_ID: string = CAMILLE_ORGANIZATION_SESSION.sessionId;

/**
 * Constant OTHER_SESSION_ID
 *
 * @description
 * Id of another session of Camille, on her phone.
 *
 * @type {string}
 */
const OTHER_SESSION_ID: string = '019a6914-2f7a-7b3c-9d4e-5f6a7b8c9d01';

/**
 * Constant PAGE
 *
 * @description
 * A page of the open sessions, as identity-service answers it.
 *
 * @type {Record<string, unknown>}
 */
const PAGE: { items: Record<string, unknown>[]; nextCursor: string | null } = {
  items: [
    {
      id: SESSION_ID,
      current: true,
      device: {
        type: 'desktop',
        browser: 'Firefox',
        browserVersion: '132',
        os: 'Windows',
        osVersion: null,
      },
      ipAddress: '192.0.2.14',
      signedInAt: '2026-11-09T07:58:00Z',
      lastActiveAt: '2026-11-09T13:24:00Z',
      expiresAt: '2026-12-09T07:58:00Z',
    },
    {
      id: OTHER_SESSION_ID,
      current: false,
      device: {
        type: 'mobile',
        browser: 'Safari',
        browserVersion: '18',
        os: 'iOS',
        osVersion: '18.1',
      },
      ipAddress: '86.247.12.30',
      signedInAt: '2026-11-09T07:42:00Z',
      lastActiveAt: '2026-11-09T11:20:00Z',
      expiresAt: '2026-12-09T07:42:00Z',
    },
  ],
  nextCursor: 'b3BhcXVl',
};

/**
 * Constant PAGE_WITH_INACTIVITY
 *
 * @description
 * The page of the open sessions as identity-service answers it from the contracts 0.8.0 on: each
 * session with the inactivity of the policy of its current organization.
 *
 * @type {{ items: Record<string, unknown>[]; nextCursor: string | null }}
 */
const PAGE_WITH_INACTIVITY: { items: Record<string, unknown>[]; nextCursor: string | null } = {
  items: PAGE.items.map((item: Record<string, unknown>, index: number) => ({
    ...item,
    inactivityTimeoutMinutes: index === 0 ? 60 : 720,
  })),
  nextCursor: null,
};

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each route of the open sessions.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  {
    name: 'GET /v1/sessions lists the open sessions with the session of the request as currentSessionId',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions?cursor=b3BhcXVl&limit=2',
    arrange: ({ identity }) =>
      identity.listUserSessions.mockResolvedValue({
        ...PAGE,
        items: PAGE.items.map((item) => ({ ...item, token: 'never-public' })),
      } as never),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(PAGE);
      expect(JSON.stringify(response.body)).not.toContain('never-public');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.listUserSessions).toHaveBeenCalledWith(CAMILLE.id, {
        currentSessionId: SESSION_ID,
        cursor: 'b3BhcXVl',
        limit: 2,
      });
    },
  },
  {
    name: 'GET /v1/sessions asks the default page size without a cursor',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    credential: 'session-without-organization',
    arrange: ({ identity }) =>
      identity.listUserSessions.mockResolvedValue({ items: [], nextCursor: null }),
    status: 200,
    check: (_response, { identity }) => {
      expect(identity.listUserSessions).toHaveBeenCalledWith(CAMILLE.id, {
        currentSessionId: CAMILLE_SESSION.sessionId,
        limit: 50,
      });
    },
  },
  {
    name: 'GET /v1/sessions refuses a page size beyond the contract',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions?limit=101',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'GET /v1/sessions refuses a currentSessionId chosen by the browser',
    method: 'get',
    path: '/v1/sessions',
    url: `/v1/sessions?currentSessionId=${OTHER_SESSION_ID}`,
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.listUserSessions).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET /v1/sessions answers 401 without a session',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'GET /v1/sessions answers 404 session.not-found as 401 auth.session-expired',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    arrange: ({ identity }) =>
      identity.listUserSessions.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'GET /v1/sessions answers 404 user.not-found as 401 auth.session-expired',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    arrange: ({ identity }) =>
      identity.listUserSessions.mockRejectedValue(identityProblem(404, 'user.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'GET /v1/sessions refuses a personal API token',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    credential: 'members-token',
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'GET /v1/sessions answers 429 beyond the quota of the session',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 7 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/sessions answers 503 when identity-service cannot answer',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions',
    arrange: ({ identity }) =>
      identity.listUserSessions.mockRejectedValue(identityUnavailable('unreachable')),
    status: 503,
    code: 'upstream.unreachable',
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} closes the session of the path on its Origin alone',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    arrange: ({ identity }) => identity.revokeSession.mockResolvedValue(undefined),
    status: 204,
    check: (response, { identity }) => {
      expect(identity.revokeSession).toHaveBeenCalledWith(OTHER_SESSION_ID);
      expect(response.headers['set-cookie']).toBeUndefined();
    },
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} refuses an id that is not a UUID',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: '/v1/sessions/phone',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} answers 401 for an ended session',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    credential: { cookie: 'ended' },
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} refuses a cookie request without Origin',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    origin: null,
    status: 403,
    code: 'auth.csrf-rejected',
    check: (_response, { identity }) => {
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} refuses a personal API token',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    credential: 'members-token',
    origin: null,
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} relays 404 session.not-found as is, never as an ended session',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    arrange: ({ identity }) =>
      identity.revokeSession.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 404,
    code: 'session.not-found',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Session introuvable.',
        status: 404,
        code: 'session.not-found',
      });
    },
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} answers 429 beyond the quota of the session',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 7 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} answers 503 when identity-service cannot answer',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    arrange: ({ identity }) => identity.revokeSession.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
  {
    name: 'POST /v1/sessions/revoke-others closes every other session of the session of the request',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    body: {},
    arrange: ({ identity }) => identity.revokeOtherSessions.mockResolvedValue({ revokedCount: 2 }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ revokedCount: 2 });
      expect(identity.revokeOtherSessions).toHaveBeenCalledWith(SESSION_ID);
      expect(response.headers['set-cookie']).toBeUndefined();
    },
  },
  {
    name: 'POST /v1/sessions/revoke-others refuses a body with members',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    body: { sessionId: OTHER_SESSION_ID },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.revokeOtherSessions).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/sessions/revoke-others answers 404 session.not-found as 401 auth.session-expired',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    body: {},
    arrange: ({ identity }) =>
      identity.revokeOtherSessions.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'POST /v1/sessions/revoke-others refuses a cookie request from another origin',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    origin: 'https://evil.test',
    body: {},
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'POST /v1/sessions/revoke-others answers 429 beyond the quota of the session',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    body: {},
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 7 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/sessions/revoke-others answers an undeclared code of identity-service as 503 upstream.failed',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    body: {},
    arrange: ({ identity }) =>
      identity.revokeOtherSessions.mockRejectedValue(identityProblem(409, 'session.conflict')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'POST /v1/sessions/revoke-others answers an internal 400 as 503 upstream.failed: the browser sent nothing it reads',
    method: 'post',
    path: '/v1/sessions/revoke-others',
    url: '/v1/sessions/revoke-others',
    body: {},
    arrange: ({ identity }) =>
      identity.revokeOtherSessions.mockRejectedValue(identityProblem(400, 'request.invalid')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'DELETE /v1/sessions/{sessionId} answers an internal 400 as 503 upstream.failed',
    method: 'delete',
    path: '/v1/sessions/{sessionId}',
    url: `/v1/sessions/${OTHER_SESSION_ID}`,
    arrange: ({ identity }) =>
      identity.revokeSession.mockRejectedValue(identityProblem(400, 'request.invalid')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'GET /v1/sessions relays an internal 400 request.invalid about the cursor of the browser',
    method: 'get',
    path: '/v1/sessions',
    url: '/v1/sessions?cursor=not-a-cursor',
    arrange: ({ identity }) =>
      identity.listUserSessions.mockRejectedValue(
        identityProblem(400, 'request.invalid', {
          issues: [{ in: 'query', path: 'cursor', code: 'custom', message: 'Invalid cursor' }],
        }),
      ),
    status: 400,
    code: 'request.invalid',
  },
];

describe('routes of the open sessions', () => {
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

  it('exercises every status each session route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  describe('GET /v1/sessions and the inactivity of each session', () => {
    it('passes inactivityTimeoutMinutes on, session by session', async () => {
      identity.listUserSessions.mockResolvedValue(PAGE_WITH_INACTIVITY as never);

      const response = await runRouteCase(application, identity, {
        name: 'inactivity',
        method: 'get',
        path: '/v1/sessions',
        url: '/v1/sessions',
        status: 200,
      });

      expect(response.body).toEqual(PAGE_WITH_INACTIVITY);
    });

    it('leaves inactivityTimeoutMinutes out while identity-service does not send it', async () => {
      identity.listUserSessions.mockResolvedValue(PAGE as never);

      const response = await runRouteCase(application, identity, {
        name: 'no inactivity',
        method: 'get',
        path: '/v1/sessions',
        url: '/v1/sessions',
        status: 200,
      });

      const items: readonly Record<string, unknown>[] = (
        response.body as { items: Record<string, unknown>[] }
      ).items;
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item).not.toHaveProperty('inactivityTimeoutMinutes');
      }
    });
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('calls identity-service as the user of the session, and counts the session, never its address', async () => {
    let context: OrganizationContext | undefined;
    identity.revokeOtherSessions.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve({ revokedCount: 0 });
    });

    await runRouteCase(application, identity, {
      name: 'revoke others',
      method: 'post',
      path: '/v1/sessions/revoke-others',
      url: '/v1/sessions/revoke-others',
      body: {},
      status: 200,
    });

    expect(context).toMatchObject({ actor: { type: 'user', id: CAMILLE.id } });
    expect(application.counter.consume).toHaveBeenCalledWith(`session:${SESSION_ID}`);
    expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
  });
});
