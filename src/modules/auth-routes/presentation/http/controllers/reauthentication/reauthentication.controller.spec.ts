import type request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_SESSION,
  createFakeIdentity,
  identityProblem,
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
 * Constant PASSWORD
 *
 * @description
 * Password confirmed by the re-authentication: a secret that must never reach a log line.
 *
 * @type {string}
 */
const PASSWORD: string = 'atelier-nord-sprint-14-secret';

/**
 * Constant CODE
 *
 * @description
 * Code of the authenticator app confirmed by the re-authentication: a secret too.
 *
 * @type {string}
 */
const CODE: string = '261845';

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
 * Constant CASES
 *
 * @description
 * The success and every declared error of `POST /v1/auth/reauthentication`.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/auth/reauthentication confirms the password in the session of the cookie',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    credential: 'session-without-organization',
    body: { password: PASSWORD },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockResolvedValue({
        authenticatedAt: '2026-11-09T13:12:00Z',
        expiresAt: '2026-11-09T13:22:00Z',
      }),
    status: 200,
    check: (response, { identity, counter }) => {
      expect(response.body).toEqual({
        authenticatedAt: '2026-11-09T13:12:00Z',
        expiresAt: '2026-11-09T13:22:00Z',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.reauthenticate).toHaveBeenCalledWith(CAMILLE_SESSION.sessionId, {
        password: PASSWORD,
      });
      expect(counter.consume).toHaveBeenCalledWith(`session:${CAMILLE_SESSION.sessionId}`);
    },
  },
  {
    name: 'POST /v1/auth/reauthentication refuses an empty password',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: '' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/auth/reauthentication answers 401 without a session',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    credential: 'none',
    body: { password: PASSWORD },
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/auth/reauthentication answers 404 session.not-found as 401 auth.session-expired',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'POST /v1/auth/reauthentication refuses a personal API token',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    credential: 'members-token',
    body: { password: PASSWORD },
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'POST /v1/auth/reauthentication refuses another origin before the introspection',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    origin: 'https://evil.test',
    body: { password: PASSWORD },
    status: 403,
    code: 'auth.csrf-rejected',
    check: (_response, { identity }) => {
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/auth/reauthentication relays 422 auth.password-incorrect with the attempts left',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(
        identityProblem(422, 'auth.password-incorrect', { remainingAttempts: 3 }),
      ),
    status: 422,
    code: 'auth.password-incorrect',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Mot de passe incorrect.',
        status: 422,
        code: 'auth.password-incorrect',
        details: { remainingAttempts: 3 },
      });
    },
  },
  {
    name: 'POST /v1/auth/reauthentication relays 429 auth.account-locked with Retry-After',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(
        identityProblem(429, 'auth.account-locked', { lockedUntil: inSeconds(900) }),
      ),
    status: 429,
    code: 'auth.account-locked',
    check: (response) => {
      expectRetryAfterAtMost(response, 900);
    },
  },
  {
    name: 'POST /v1/auth/reauthentication answers 429 beyond the quota of the session',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD },
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/auth/reauthentication answers 503 when identity-service cannot answer',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(identityProblem(403, 'auth.actor-not-allowed')),
    status: 503,
    code: 'upstream.unauthorized',
  },
  {
    name: 'POST /v1/auth/reauthentication answers a personal API token without Origin 403 auth.api-token-not-accepted',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    credential: 'members-token',
    origin: null,
    body: { password: PASSWORD },
    status: 403,
    code: 'auth.api-token-not-accepted',
    check: (_response, { identity }) => {
      expect(identity.reauthenticate).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/auth/reauthentication answers 401 to a request from another origin without a session',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    credential: 'none',
    origin: 'https://evil.test',
    body: { password: PASSWORD },
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/auth/reauthentication confirms a code of the authenticator app, with no password member',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { code: CODE },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockResolvedValue({
        authenticatedAt: '2026-11-09T13:12:00Z',
        expiresAt: '2026-11-09T13:22:00Z',
      }),
    status: 200,
    check: (_response, { identity }) => {
      expect(identity.reauthenticate).toHaveBeenCalledWith(CAMILLE_ORGANIZATION_SESSION.sessionId, {
        code: CODE,
      });
    },
  },
  {
    name: 'POST /v1/auth/reauthentication sends both members as the browser sent them, for identity-service to refuse',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD, code: CODE },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(
        identityProblem(400, 'request.invalid', {
          issues: [{ in: 'body', path: '', code: 'custom', message: 'One of password or code' }],
        }),
      ),
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.reauthenticate).toHaveBeenCalledWith(CAMILLE_ORGANIZATION_SESSION.sessionId, {
        password: PASSWORD,
        code: CODE,
      });
    },
  },
  {
    name: 'POST /v1/auth/reauthentication refuses a code that is not 6 digits before identity-service',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { code: '26184' },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.reauthenticate).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/auth/reauthentication relays 403 auth.reauthentication-required for a password of a two-step account',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { password: PASSWORD },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(
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
    },
  },
  {
    name: 'POST /v1/auth/reauthentication relays 409 auth.two-step-not-enabled for a code without an app',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { code: CODE },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(identityProblem(409, 'auth.two-step-not-enabled')),
    status: 409,
    code: 'auth.two-step-not-enabled',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Activez d’abord la vérification en deux étapes.',
      });
    },
  },
  {
    name: 'POST /v1/auth/reauthentication relays 422 auth.two-step-code-invalid with the attempts left',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { code: CODE },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(
        identityProblem(422, 'auth.two-step-code-invalid', { remainingAttempts: 4 }),
      ),
    status: 422,
    code: 'auth.two-step-code-invalid',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Code incorrect ou déjà utilisé.',
        status: 422,
        code: 'auth.two-step-code-invalid',
        details: { remainingAttempts: 4 },
      });
    },
  },
  {
    name: 'POST /v1/auth/reauthentication relays 429 auth.two-step-locked with Retry-After',
    method: 'post',
    path: '/v1/auth/reauthentication',
    url: '/v1/auth/reauthentication',
    body: { code: CODE },
    arrange: ({ identity }) =>
      identity.reauthenticate.mockRejectedValue(
        identityProblem(429, 'auth.two-step-locked', { lockedUntil: inSeconds(900) }),
      ),
    status: 429,
    code: 'auth.two-step-locked',
    check: (response) => {
      expectRetryAfterAtMost(response, 900);
      expect(response.body).toMatchObject({
        title: 'Trop de tentatives échouées : réessayez dans 15 minutes.',
      });
    },
  },
];

describe('POST /v1/auth/reauthentication', () => {
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

  it('exercises every status the route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('never writes the password into the logs, whatever the outcome', async () => {
    application.logLines.length = 0;
    identity.reauthenticate
      .mockRejectedValueOnce(identityProblem(422, 'auth.password-incorrect'))
      .mockRejectedValueOnce(
        identityProblem(429, 'auth.account-locked', { lockedUntil: inSeconds(60) }),
      )
      .mockResolvedValueOnce({
        authenticatedAt: '2026-11-09T13:12:00Z',
        expiresAt: '2026-11-09T13:22:00Z',
      });
    const confirm: RouteCase = {
      name: 'reauthentication',
      method: 'post',
      path: '/v1/auth/reauthentication',
      url: '/v1/auth/reauthentication',
      body: { password: PASSWORD },
      status: 422,
    };

    await runRouteCase(application, identity, confirm);
    await runRouteCase(application, identity, { ...confirm, status: 429 });
    await runRouteCase(application, identity, { ...confirm, status: 200 });
    await runRouteCase(application, identity, {
      ...confirm,
      body: { password: `${PASSWORD}${'x'.repeat(256)}` },
      status: 400,
    });

    identity.reauthenticate.mockRejectedValueOnce(
      identityProblem(422, 'auth.two-step-code-invalid', { remainingAttempts: 4 }),
    );
    await runRouteCase(application, identity, { ...confirm, body: { code: CODE }, status: 422 });

    expect(application.logLines.length).toBeGreaterThan(0);
    expect(application.logLines.join('\n')).not.toContain(PASSWORD);
    expect(application.logLines.join('\n')).not.toContain(CODE);
    expect(identity.reauthenticate).toHaveBeenLastCalledWith(
      CAMILLE_ORGANIZATION_SESSION.sessionId,
      { code: CODE },
    );
  });
});
