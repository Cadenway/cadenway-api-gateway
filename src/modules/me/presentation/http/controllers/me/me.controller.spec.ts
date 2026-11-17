import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ALL_SCOPES,
  CAMILLE,
  CAMILLE_TOKEN,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { expectPublicResponse } from '../../../../../../../tests/support/public-contract.js';
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
 * Function getMe
 *
 * @description
 * Sends `GET /v1/me`, with the session cookie when a token is given.
 *
 * @param {RouteApplication} application - Application under test.
 * @param {string | undefined} token - Value of the session cookie.
 * @returns {Promise<request.Response>} The response, already checked against the public contract.
 */
async function getMe(application: RouteApplication, token?: string): Promise<request.Response> {
  let pending: request.Test = request(application.server).get('/v1/me');
  if (token !== undefined) {
    pending = pending.set('Cookie', `__Host-cw_session=${token}`);
  }
  const response: request.Response = await pending;
  expectPublicResponse('get', '/v1/me', response);
  return response;
}

describe('GET /v1/me', () => {
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

  it('answers the account of the session, with its version as ETag', async () => {
    identity.getUser.mockResolvedValue({ ...CAMILLE });

    const response: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(CAMILLE);
    expect(response.headers.etag).toBe('"2"');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(identity.introspect).toHaveBeenCalledWith(CAMILLE_TOKEN);
    expect(identity.getUser).toHaveBeenCalledWith(CAMILLE.id);
  });

  it('reads the account in the organization context of the session: a user, no organization', async () => {
    let context: OrganizationContext | undefined;
    identity.getUser.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve({ ...CAMILLE });
    });

    await getMe(application, CAMILLE_TOKEN);

    expect(context).toEqual({
      organizationId: null,
      actor: { type: 'user', id: CAMILLE.id },
      role: null,
      scopes: ALL_SCOPES,
    });
  });

  it('writes the user of the session on the completion line, never the token', async () => {
    identity.getUser.mockResolvedValue({ ...CAMILLE });
    application.logLines.length = 0;

    await getMe(application, CAMILLE_TOKEN);

    const completion: Record<string, unknown> | undefined = application.logLines
      .map((line: string) => JSON.parse(line) as Record<string, unknown>)
      .find((line: Record<string, unknown>) => line.route === '/v1/me');
    expect(completion).toMatchObject({ status: 200, userId: CAMILLE.id });
    expect(application.logLines.join('\n')).not.toContain(CAMILLE_TOKEN);
  });

  it('introspects the cookie on every request, without a cache', async () => {
    identity.getUser.mockResolvedValue({ ...CAMILLE });

    await getMe(application, CAMILLE_TOKEN);
    await getMe(application, CAMILLE_TOKEN);
    identity.introspect.mockResolvedValueOnce(null);
    const revoked: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(identity.introspect).toHaveBeenCalledTimes(3);
    expect(revoked.status).toBe(401);
    expect(revoked.body).toMatchObject({ code: 'auth.session-expired' });
  });

  it('answers 401 auth.session-required without a cookie, calling nothing', async () => {
    const response: request.Response = await getMe(application);

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Connectez-vous pour continuer.',
      status: 401,
      code: 'auth.session-required',
      detail: 'This request needs a session.',
    });
    expect(identity.introspect).not.toHaveBeenCalled();
  });

  it('answers 401 auth.session-required for an empty cookie', async () => {
    const response: request.Response = await getMe(application, '');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'auth.session-required' });
  });

  it('answers 401 auth.session-expired for a session identity-service does not find active', async () => {
    const response: request.Response = await getMe(application, 'revoked-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Session expirée',
      status: 401,
      code: 'auth.session-expired',
      detail: 'The session of this request has ended.',
    });
    expect(identity.getUser).not.toHaveBeenCalled();
  });

  it.each([
    ['longer than a token can be', 'x'.repeat(257)],
    ['a JSON value of cookie-parser', 'j:{"userId":"019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30"}'],
  ])(
    'answers 401 auth.session-expired for a cookie %s, without calling identity-service',
    async (_label, value) => {
      const response: request.Response = await getMe(application, encodeURIComponent(value));

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'auth.session-expired' });
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  );

  it('answers 401 auth.session-expired when the account of the session is gone', async () => {
    identity.getUser.mockRejectedValue(identityProblem(404, 'user.not-found'));

    const response: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'auth.session-expired', title: 'Session expirée' });
  });

  it('answers 503 when the introspection cannot be made', async () => {
    identity.introspect.mockRejectedValue(identityUnavailable('timeout'));

    const response: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      code: 'upstream.timeout',
      details: { service: 'identity-service' },
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    [403, 'auth.actor-not-allowed', 'upstream.unauthorized'],
    [403, 'auth.issuer-not-allowed', 'upstream.unauthorized'],
    [400, 'request.invalid', 'upstream.failed'],
    [429, 'auth.code-throttled', 'upstream.failed'],
  ] as const)(
    'answers a client error of the introspection (%i %s) as 503 %s, never as is',
    async (status, code, publicCode) => {
      identity.introspect.mockRejectedValue(identityProblem(status, code));

      const response: request.Response = await getMe(application, CAMILLE_TOKEN);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        title: 'Service Unavailable',
        code: publicCode,
        details: { service: 'identity-service' },
      });
      expect(JSON.stringify(response.body)).not.toContain(code);
      expect(response.body).not.toHaveProperty(
        'detail',
        'Internal wording that never reaches the browser.',
      );
    },
  );

  it('answers 503 when the account cannot be read', async () => {
    identity.getUser.mockRejectedValue(identityUnavailable('unreachable'));

    const response: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'upstream.unreachable' });
  });

  it('answers a refused internal token as 503 upstream.unauthorized', async () => {
    identity.getUser.mockRejectedValue(identityProblem(403, 'auth.actor-not-allowed'));

    const response: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'upstream.unauthorized' });
  });

  it('answers another client error of identity-service as 503 upstream.failed', async () => {
    identity.getUser.mockRejectedValue(identityProblem(400, 'request.invalid'));

    const response: request.Response = await getMe(application, CAMILLE_TOKEN);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'upstream.failed' });
  });
});

/**
 * Constant PROFILE_CASES
 *
 * @description
 * The success and every declared error of `PATCH /v1/me`.
 *
 * @type {readonly RouteCase[]}
 */
const PROFILE_CASES: readonly RouteCase[] = [
  {
    name: 'PATCH /v1/me applies the patch to the account of the session, keeping null and relaying If-Match',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    credential: 'session-without-organization',
    body: { displayName: 'camille', jobTitle: null, timeZone: 'Europe/Lisbon', language: 'en' },
    headers: { 'If-Match': '"2"' },
    arrange: ({ identity }) =>
      identity.updateUser.mockResolvedValue({
        ...CAMILLE,
        displayName: 'camille',
        timeZone: 'Europe/Lisbon',
        language: 'en',
        version: 3,
      }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toMatchObject({ displayName: 'camille', jobTitle: null, version: 3 });
      expect(response.headers.etag).toBe('"3"');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.updateUser).toHaveBeenCalledWith(
        CAMILLE.id,
        { displayName: 'camille', jobTitle: null, timeZone: 'Europe/Lisbon', language: 'en' },
        '"2"',
      );
    },
  },
  {
    name: 'PATCH /v1/me answers an older identity-service without the profile fields with their defaults',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: {},
    arrange: ({ identity }) =>
      identity.updateUser.mockResolvedValue({
        id: CAMILLE.id,
        name: CAMILLE.name,
        email: CAMILLE.email,
        language: 'fr',
        version: 2,
      }),
    status: 200,
    check: (response) => {
      expect(response.body).toMatchObject({
        displayName: null,
        jobTitle: null,
        timeZone: 'Europe/Paris',
      });
    },
  },
  {
    name: 'PATCH /v1/me refuses a language the contract does not know before any call',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: { language: 'it' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'PATCH /v1/me relays 400 request.invalid on an unknown time zone',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: { timeZone: 'Mars/Olympus' },
    arrange: ({ identity }) =>
      identity.updateUser.mockRejectedValue(
        identityProblem(400, 'request.invalid', {
          issues: [{ in: 'body', path: 'timeZone', code: 'custom', message: 'Unknown time zone' }],
        }),
      ),
    status: 400,
    code: 'request.invalid',
    check: (response) => {
      expect(response.body).toMatchObject({ details: { issues: [{ path: 'timeZone' }] } });
    },
  },
  {
    name: 'PATCH /v1/me answers 401 auth.session-expired when the account is gone',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: { name: 'Camille M.' },
    arrange: ({ identity }) =>
      identity.updateUser.mockRejectedValue(identityProblem(404, 'user.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'PATCH /v1/me refuses a personal API token',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    credential: 'members-token',
    origin: null,
    body: { name: 'Camille M.' },
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'PATCH /v1/me relays 412 request.version-mismatch',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: { name: 'Camille M.' },
    headers: { 'If-Match': '"1"' },
    arrange: ({ identity }) =>
      identity.updateUser.mockRejectedValue(
        identityProblem(412, 'request.version-mismatch', { version: 2 }),
      ),
    status: 412,
    code: 'request.version-mismatch',
  },
  {
    name: 'PATCH /v1/me answers 429 beyond the quota',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: {},
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 11 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'PATCH /v1/me answers 503 when identity-service cannot answer',
    method: 'patch',
    path: '/v1/me',
    url: '/v1/me',
    body: {},
    arrange: ({ identity }) => identity.updateUser.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
];

describe('the profile and the credentials of /v1/me', () => {
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

  it('exercises every status PATCH /v1/me declares', () => {
    expectEveryDeclaredStatus(PROFILE_CASES);
  });

  it.each(PROFILE_CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('refuses a personal API token on GET /v1/me, after its introspection', async () => {
    await runRouteCase(application, identity, {
      name: 'token on the account',
      method: 'get',
      path: '/v1/me',
      url: '/v1/me',
      credential: 'tasks-token',
      status: 403,
      code: 'auth.api-token-not-accepted',
    });

    expect(identity.introspectApiToken).toHaveBeenCalledTimes(1);
    expect(identity.getUser).not.toHaveBeenCalled();
  });

  it('answers 401 auth.api-token-invalid for an inactive token on GET /v1/me', async () => {
    identity.introspectApiToken.mockResolvedValueOnce(null);

    await runRouteCase(application, identity, {
      name: 'inactive token',
      method: 'get',
      path: '/v1/me',
      url: '/v1/me',
      credential: 'tasks-token',
      status: 401,
      code: 'auth.api-token-invalid',
    });
  });

  it('answers 429 on GET /v1/me beyond the quota of the session, with Retry-After', async () => {
    application.counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 33 });

    const response: request.Response = await runRouteCase(application, identity, {
      name: 'limited session',
      method: 'get',
      path: '/v1/me',
      url: '/v1/me',
      credential: 'session-without-organization',
      status: 429,
      code: 'rate-limit.exceeded',
    });

    expect(response.headers['retry-after']).toBe('33');
    expect(identity.getUser).not.toHaveBeenCalled();
  });
});
