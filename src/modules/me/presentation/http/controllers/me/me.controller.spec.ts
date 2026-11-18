import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ALL_SCOPES,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
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
 * Constant CURRENT_PASSWORD
 *
 * @description
 * Current password of the account in the tests: it must never reach a log line.
 *
 * @type {string}
 */
const CURRENT_PASSWORD: string = 'current-secret-password-0001';

/**
 * Constant NEW_PASSWORD
 *
 * @description
 * New password of the account in the tests: it must never reach a log line.
 *
 * @type {string}
 */
const NEW_PASSWORD: string = 'brand-new-secret-password-0002';

/**
 * Constant EMAIL_CODE
 *
 * @description
 * Code of a change of address in the tests: it must never reach a log line.
 *
 * @type {string}
 */
const EMAIL_CODE: string = '731406';

/**
 * Constant NEW_EMAIL
 *
 * @description
 * New address of the account in the tests.
 *
 * @type {string}
 */
const NEW_EMAIL: string = 'camille@ateliernord.fr';

/**
 * Constant CLEARED_COOKIE
 *
 * @description
 * `Set-Cookie` of a cleared session cookie, as the contract documents it.
 *
 * @type {string}
 */
const CLEARED_COOKIE: string =
  '__Host-cw_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';

/**
 * Function inSeconds
 *
 * @description
 * An instant some seconds from now, as identity-service writes it in `details`.
 *
 * @param {number} seconds - Seconds from now.
 * @returns {string} The ISO 8601 instant.
 */
function inSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Function expectRetryAfterAtMost
 *
 * @description
 * Checks that `Retry-After` is a whole number of seconds between 1 and a maximum.
 *
 * @param {request.Response} response - The response.
 * @param {number} seconds - The largest value expected.
 */
function expectRetryAfterAtMost(response: request.Response, seconds: number): void {
  const value: number = Number(response.headers['retry-after']);
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(1);
  expect(value).toBeLessThanOrEqual(seconds);
}

/**
 * Function expectNoCookie
 *
 * @description
 * Checks that a response leaves the session cookie alone.
 *
 * @param {request.Response} response - The response.
 */
function expectNoCookie(response: request.Response): void {
  expect(response.headers['set-cookie']).toBeUndefined();
}

/**
 * Constant ACCOUNT_AFTER_CHANGE
 *
 * @description
 * The account as identity-service answers it after a change of password.
 *
 * @type {typeof CAMILLE & { passwordChangedAt: string }}
 */
const ACCOUNT_AFTER_CHANGE: typeof CAMILLE & { passwordChangedAt: string } = {
  ...CAMILLE,
  passwordChangedAt: '2026-11-09T13:16:00Z',
  version: 4,
};

/**
 * Constant SECURITY_CASES
 *
 * @description
 * The success and every declared error of the routes about the security of the account: the
 * password, the address and the deletion.
 *
 * @type {readonly RouteCase[]}
 */
const SECURITY_CASES: readonly RouteCase[] = [
  {
    name: 'PUT /v1/me/password changes the password with the session and the browser, answering passwordChangedAt and ETag',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    headers: { 'User-Agent': 'Firefox', 'X-Forwarded-For': '192.0.2.14' },
    arrange: ({ identity }) => identity.changePassword.mockResolvedValue(ACCOUNT_AFTER_CHANGE),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(ACCOUNT_AFTER_CHANGE);
      expect(response.headers.etag).toBe('"4"');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.changePassword).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
        client: { ipAddress: '192.0.2.14', userAgent: 'Firefox' },
      });
    },
  },
  {
    name: 'PUT /v1/me/password leaves passwordChangedAt out while identity-service does not send it',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) => identity.changePassword.mockResolvedValue({ ...CAMILLE }),
    status: 200,
    check: (response) => {
      expect(response.body).not.toHaveProperty('passwordChangedAt');
    },
  },
  {
    name: 'PUT /v1/me/password refuses a body without the current password before any call',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { newPassword: NEW_PASSWORD },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.changePassword).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PUT /v1/me/password answers 401 without a session',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    credential: 'none',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'PUT /v1/me/password answers 404 session.not-found as 401 auth.session-expired',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.changePassword.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Session expirée' });
    },
  },
  {
    name: 'PUT /v1/me/password answers 404 user.not-found as 401 auth.session-expired',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.changePassword.mockRejectedValue(identityProblem(404, 'user.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'PUT /v1/me/password refuses a personal API token',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    credential: 'members-token',
    origin: null,
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'PUT /v1/me/password relays 403 auth.reauthentication-required of an account with two-step verification',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.changePassword.mockRejectedValue(
        identityProblem(403, 'auth.reauthentication-required', {
          methods: ['authenticator-app'],
        }),
      ),
    status: 403,
    code: 'auth.reauthentication-required',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Confirmez votre identité pour continuer.',
        status: 403,
        code: 'auth.reauthentication-required',
        details: { methods: ['authenticator-app'] },
      });
      expect(response.headers['cache-control']).toBe('no-store');
    },
  },
  {
    name: 'PUT /v1/me/password refuses a cookie request from another origin before the introspection',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    origin: 'https://evil.test',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    status: 403,
    code: 'auth.csrf-rejected',
    check: (_response, { identity }) => {
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  },
  ...(
    [
      [
        'auth.password-too-short',
        { minLength: 12 },
        'Le mot de passe doit compter 12 caractères minimum.',
      ],
      [
        'auth.password-compromised',
        {},
        'Ce mot de passe figure parmi des mots de passe divulgués : choisissez-en un autre.',
      ],
      ['auth.password-incorrect', { remainingAttempts: 3 }, 'Mot de passe incorrect.'],
    ] as const
  ).map(([code, details, title]): RouteCase => ({
    name: `PUT /v1/me/password relays 422 ${code} with its French title`,
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.changePassword.mockRejectedValue(identityProblem(422, code, details)),
    status: 422,
    code,
    check: (response) => {
      expect(response.body).toMatchObject({ title });
      if (Object.keys(details).length === 0) {
        expect(response.body).not.toHaveProperty('details');
      } else {
        expect(response.body).toMatchObject({ details });
      }
    },
  })),
  {
    name: 'PUT /v1/me/password relays 429 auth.account-locked with Retry-After',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.changePassword.mockRejectedValue(
        identityProblem(429, 'auth.account-locked', { lockedUntil: inSeconds(900) }),
      ),
    status: 429,
    code: 'auth.account-locked',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Trop de tentatives échouées.' });
      expectRetryAfterAtMost(response, 900);
    },
  },
  {
    name: 'PUT /v1/me/password answers 429 beyond the quota of the session',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'PUT /v1/me/password answers an undeclared code of identity-service as 503 upstream.failed',
    method: 'put',
    path: '/v1/me/password',
    url: '/v1/me/password',
    body: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.changePassword.mockRejectedValue(identityProblem(422, 'auth.code-invalid')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'POST /v1/me/email-change sends a code to the new address with the session',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: NEW_EMAIL },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockResolvedValue({
        email: NEW_EMAIL,
        expiresAt: '2026-11-09T13:35:00Z',
        resendAvailableAt: '2026-11-09T13:20:30Z',
      }),
    status: 202,
    check: (response, { identity }) => {
      expect(response.body).toEqual({
        email: NEW_EMAIL,
        expiresAt: '2026-11-09T13:35:00Z',
        resendAvailableAt: '2026-11-09T13:20:30Z',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.requestEmailChange).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        email: NEW_EMAIL,
      });
    },
  },
  {
    name: 'POST /v1/me/email-change refuses an address that is not one',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: 'camille' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/me/email-change answers 404 session.not-found as 401 auth.session-expired',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: NEW_EMAIL },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'POST /v1/me/email-change relays 403 auth.reauthentication-required with its methods',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: NEW_EMAIL },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockRejectedValue(
        identityProblem(403, 'auth.reauthentication-required', { methods: ['password'] }),
      ),
    status: 403,
    code: 'auth.reauthentication-required',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Confirmez votre identité pour continuer.',
        status: 403,
        code: 'auth.reauthentication-required',
        details: { methods: ['password'] },
      });
    },
  },
  {
    name: 'POST /v1/me/email-change refuses a personal API token',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    credential: 'tasks-token',
    origin: null,
    body: { email: NEW_EMAIL },
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'POST /v1/me/email-change relays 409 auth.email-taken',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: NEW_EMAIL },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockRejectedValue(identityProblem(409, 'auth.email-taken')),
    status: 409,
    code: 'auth.email-taken',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Un compte existe déjà avec cette adresse.' });
    },
  },
  {
    name: 'POST /v1/me/email-change relays 422 auth.email-unchanged',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: CAMILLE.email },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockRejectedValue(identityProblem(422, 'auth.email-unchanged')),
    status: 422,
    code: 'auth.email-unchanged',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'C’est déjà votre adresse actuelle : saisissez la nouvelle.',
      });
    },
  },
  {
    name: 'POST /v1/me/email-change relays 429 auth.code-throttled with Retry-After',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: NEW_EMAIL },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockRejectedValue(
        identityProblem(429, 'auth.code-throttled', { resendAvailableAt: inSeconds(30) }),
      ),
    status: 429,
    code: 'auth.code-throttled',
    check: (response) => {
      expectRetryAfterAtMost(response, 30);
      const body = response.body as { details?: { resendAvailableAt?: unknown } };
      expect(typeof body.details?.resendAvailableAt).toBe('string');
    },
  },
  {
    name: 'POST /v1/me/email-change answers 503 when identity-service cannot answer',
    method: 'post',
    path: '/v1/me/email-change',
    url: '/v1/me/email-change',
    body: { email: NEW_EMAIL },
    arrange: ({ identity }) =>
      identity.requestEmailChange.mockRejectedValue(identityUnavailable('timeout')),
    status: 503,
    code: 'upstream.timeout',
  },
  {
    name: 'POST /v1/me/email-change/confirmation confirms the code with the session and the browser',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: EMAIL_CODE },
    headers: { 'User-Agent': 'Firefox', 'X-Forwarded-For': '192.0.2.14' },
    arrange: ({ identity }) =>
      identity.confirmEmailChange.mockResolvedValue({
        ...ACCOUNT_AFTER_CHANGE,
        email: NEW_EMAIL,
        version: 5,
      }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ ...ACCOUNT_AFTER_CHANGE, email: NEW_EMAIL, version: 5 });
      expect(response.headers.etag).toBe('"5"');
      expect(identity.confirmEmailChange).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        code: EMAIL_CODE,
        client: { ipAddress: '192.0.2.14', userAgent: 'Firefox' },
      });
    },
  },
  {
    name: 'POST /v1/me/email-change/confirmation refuses a code that is not 6 digits',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: '73140' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/me/email-change/confirmation answers 404 user.not-found as 401 auth.session-expired',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: EMAIL_CODE },
    arrange: ({ identity }) =>
      identity.confirmEmailChange.mockRejectedValue(identityProblem(404, 'user.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'POST /v1/me/email-change/confirmation refuses a cookie request without Content-Type JSON',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ code: EMAIL_CODE }),
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'POST /v1/me/email-change/confirmation relays 409 auth.email-taken',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: EMAIL_CODE },
    arrange: ({ identity }) =>
      identity.confirmEmailChange.mockRejectedValue(identityProblem(409, 'auth.email-taken')),
    status: 409,
    code: 'auth.email-taken',
  },
  ...(['auth.code-invalid', 'auth.code-expired'] as const).map((code): RouteCase => ({
    name: `POST /v1/me/email-change/confirmation relays 422 ${code}`,
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: EMAIL_CODE },
    arrange: ({ identity }) =>
      identity.confirmEmailChange.mockRejectedValue(identityProblem(422, code)),
    status: 422,
    code,
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Code incorrect ou expiré : vérifiez le dernier e-mail reçu.',
      });
    },
  })),
  {
    name: 'POST /v1/me/email-change/confirmation answers 429 beyond the quota of the session',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: EMAIL_CODE },
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 4 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/me/email-change/confirmation answers 503 when identity-service cannot answer',
    method: 'post',
    path: '/v1/me/email-change/confirmation',
    url: '/v1/me/email-change/confirmation',
    body: { code: EMAIL_CODE },
    arrange: ({ identity }) =>
      identity.confirmEmailChange.mockRejectedValue(identityUnavailable('circuit-open')),
    status: 503,
    code: 'upstream.circuit-open',
  },
  {
    name: 'POST /v1/me/deletion schedules the deletion with the session and clears the cookie on its 202',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ identity }) =>
      identity.scheduleAccountDeletion.mockResolvedValue({ deleteAt: '2026-12-09T15:30:00Z' }),
    status: 202,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ deleteAt: '2026-12-09T15:30:00Z' });
      expect(response.headers['set-cookie']).toEqual([CLEARED_COOKIE]);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.scheduleAccountDeletion).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
      });
    },
  },
  {
    name: 'POST /v1/me/deletion refuses a body with members: the contract allows the empty object only',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: { now: true },
    status: 400,
    code: 'request.invalid',
    check: (response, { identity }) => {
      expectNoCookie(response);
      expect(identity.scheduleAccountDeletion).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/me/deletion answers 401 without a session',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    credential: 'none',
    body: {},
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/me/deletion answers 404 session.not-found as 401 auth.session-expired, leaving the cookie',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ identity }) =>
      identity.scheduleAccountDeletion.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
    check: expectNoCookie,
  },
  {
    name: 'POST /v1/me/deletion relays 403 auth.reauthentication-required, leaving the cookie',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ identity }) =>
      identity.scheduleAccountDeletion.mockRejectedValue(
        identityProblem(403, 'auth.reauthentication-required', { methods: ['password'] }),
      ),
    status: 403,
    code: 'auth.reauthentication-required',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Confirmez votre identité pour continuer.',
        details: { methods: ['password'] },
      });
      expectNoCookie(response);
    },
  },
  {
    name: 'POST /v1/me/deletion refuses a cookie request from another origin',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    origin: 'https://evil.test',
    body: {},
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'POST /v1/me/deletion relays 409 account.organization-owner with the organizations, leaving the cookie',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ identity }) =>
      identity.scheduleAccountDeletion.mockRejectedValue(
        identityProblem(409, 'account.organization-owner', {
          organizationIds: ['019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f'],
        }),
      ),
    status: 409,
    code: 'account.organization-owner',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title:
          'Chaque organisation dont vous êtes propriétaire doit d’abord avoir un autre propriétaire.',
        status: 409,
        code: 'account.organization-owner',
        details: { organizationIds: ['019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f'] },
      });
      expectNoCookie(response);
    },
  },
  {
    name: 'POST /v1/me/deletion answers 429 beyond the quota of the session',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 2 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/me/deletion answers 503 when identity-service cannot answer, leaving the cookie',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ identity }) =>
      identity.scheduleAccountDeletion.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
    check: expectNoCookie,
  },
  {
    name: 'POST /v1/me/deletion answers an internal 400 as 503 upstream.failed, leaving the cookie',
    method: 'post',
    path: '/v1/me/deletion',
    url: '/v1/me/deletion',
    body: {},
    arrange: ({ identity }) =>
      identity.scheduleAccountDeletion.mockRejectedValue(identityProblem(400, 'request.invalid')),
    status: 503,
    code: 'upstream.failed',
    check: expectNoCookie,
  },
];

describe('the security of the account under /v1/me', () => {
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

  it('exercises every status each route declares', () => {
    expectEveryDeclaredStatus(SECURITY_CASES);
  });

  it.each(SECURITY_CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('calls identity-service as the user of the session, without an organization it does not need', async () => {
    let context: OrganizationContext | undefined;
    identity.scheduleAccountDeletion.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve({ deleteAt: '2026-12-09T15:30:00Z' });
    });

    await runRouteCase(application, identity, {
      name: 'deletion',
      method: 'post',
      path: '/v1/me/deletion',
      url: '/v1/me/deletion',
      credential: 'session-without-organization',
      body: {},
      status: 202,
    });

    expect(context).toMatchObject({ actor: { type: 'user', id: CAMILLE.id } });
  });
});
