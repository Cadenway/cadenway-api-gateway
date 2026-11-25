import { getOrganizationContext } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_ORGANIZATION_TOKEN,
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
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';

const PATH = '/v1/realtime/tickets';
const TICKET = {
  token: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFA',
  expiresAt: '2026-12-08T13:08:00Z',
};

const CASES: readonly RouteCase[] = [
  {
    name: 'POST issueRealtimeTicket rejects a stale organization before the service call',
    method: 'post',
    path: PATH,
    url: PATH,
    body: {},
    headers: { 'If-Organization-Match': '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01' },
    status: 412,
    code: 'organization.context-changed',
    check: (response, { identity }) => {
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(identity.issueRealtimeTicket).not.toHaveBeenCalled();
    },
  },
  {
    name: 'issues one credential for the verified organization session',
    method: 'post',
    path: PATH,
    url: PATH,
    body: {},
    arrange: ({ identity }) => identity.issueRealtimeTicket.mockResolvedValue(TICKET),
    status: 200,
    check: (response, { identity, counter }) => {
      expect(response.body).toEqual(TICKET);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.issueRealtimeTicket).toHaveBeenCalledExactlyOnceWith(
        CAMILLE_ORGANIZATION_SESSION.sessionId,
      );
      expect(counter.consume).toHaveBeenCalledWith(
        `session:${CAMILLE_ORGANIZATION_SESSION.sessionId}`,
      );
    },
  },
  {
    name: 'rejects client-supplied selectors',
    method: 'post',
    path: PATH,
    url: PATH,
    body: { sessionId: CAMILLE_ORGANIZATION_SESSION.sessionId },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'requires a session',
    method: 'post',
    path: PATH,
    url: PATH,
    credential: 'none',
    body: {},
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'reports a session revoked after introspection',
    method: 'post',
    path: PATH,
    url: PATH,
    body: {},
    arrange: ({ identity }) =>
      identity.issueRealtimeTicket.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'requires a selected organization',
    method: 'post',
    path: PATH,
    url: PATH,
    credential: 'session-without-organization',
    body: {},
    status: 403,
    code: 'organization.not-selected',
  },
  {
    name: 'does not accept personal API tokens',
    method: 'post',
    path: PATH,
    url: PATH,
    credential: 'tasks-token',
    body: {},
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'requires the configured browser origin',
    method: 'post',
    path: PATH,
    url: PATH,
    origin: null,
    body: {},
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'conceals a missing membership',
    method: 'post',
    path: PATH,
    url: PATH,
    body: {},
    arrange: ({ identity }) =>
      identity.issueRealtimeTicket.mockRejectedValue(
        identityProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'applies the session rate limit',
    method: 'post',
    path: PATH,
    url: PATH,
    body: {},
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 10 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'reports an unavailable Identity service',
    method: 'post',
    path: PATH,
    url: PATH,
    body: {},
    arrange: ({ identity }) =>
      identity.issueRealtimeTicket.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
];

describe('POST /v1/realtime/tickets', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;

  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });
  afterEach(() => vi.clearAllMocks());
  afterAll(async () => application.app.close());

  it('exercises every status in the public contract', () => {
    expectEveryDeclaredStatus(CASES);
  });
  it.each(CASES.map((routeCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      const response = await runRouteCase(application, identity, routeCase);
      expect(response.headers['cache-control']).toBe(
        routeCase.code === 'organization.context-changed' ? 'private, no-store' : 'no-store',
      );
      expect(application.logLines.join('\n')).not.toContain(TICKET.token);
      if (
        ![200, 404, 503].includes(routeCase.status) &&
        routeCase.code !== 'auth.session-expired'
      ) {
        expect(identity.issueRealtimeTicket).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps malformed JSON out of caches before route guards', async () => {
    const response = await request(application.server)
      .post(PATH)
      .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(identity.issueRealtimeTicket).not.toHaveBeenCalled();
  });

  it('binds Identity to the verified user and organization', async () => {
    let context: ReturnType<typeof getOrganizationContext>;
    identity.issueRealtimeTicket.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve(TICKET);
    });
    await runRouteCase(application, identity, {
      name: 'context',
      method: 'post',
      path: PATH,
      url: PATH,
      body: {},
      status: 200,
    });
    expect(context).toMatchObject({
      organizationId: ATELIER_NORD_ID,
      actor: { type: 'user', id: CAMILLE.id },
    });
  });
});
