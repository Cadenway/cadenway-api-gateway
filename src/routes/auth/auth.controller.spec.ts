import type { SessionIssued } from '@cadenway/contracts/types/internal/identity-service';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CAMILLE,
  CAMILLE_SESSION,
  CAMILLE_TOKEN,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
} from '../../../test/support/fake-identity.js';
import { expectPublicResponse } from '../../../test/support/public-contract.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../test/support/route-application.js';
import { ALLOWED_ORIGIN, WEBSITE_ORIGIN } from '../../../test/support/test-environment.js';

/**
 * Constant NOW
 *
 * @description
 * Fixed current time of the tests, the morning of the mockup.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-08T13:07:00Z');

/**
 * Constant BROWSER
 *
 * @description
 * User-Agent of the browser in the tests.
 *
 * @type {string}
 */
const BROWSER: string =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0';

/**
 * Constant CODE_SENT
 *
 * @description
 * Answer of identity-service to a code request: 10 minutes to use it, 30 seconds before another.
 *
 * @type {{ email: string; expiresAt: string; resendAvailableAt: string }}
 */
const CODE_SENT: { email: string; expiresAt: string; resendAvailableAt: string } = {
  email: CAMILLE.email,
  expiresAt: '2026-11-08T13:17:00Z',
  resendAvailableAt: '2026-11-08T13:07:30Z',
};

/**
 * Function issuedSession
 *
 * @description
 * Answer of identity-service to a route that signs in.
 *
 * @param {boolean} persistent - Whether `rememberMe` was set.
 * @returns {SessionIssued} The session, its token and the user.
 */
function issuedSession(persistent: boolean): SessionIssued {
  return {
    token: 'new-session-token-0123456789',
    session: {
      id: CAMILLE_SESSION.sessionId,
      expiresAt: persistent ? '2026-12-08T13:07:00Z' : '2026-11-09T01:07:00Z',
      persistent,
    },
    user: { ...CAMILLE },
  };
}

/**
 * Interface Route
 *
 * @description
 * A route of `openapi/public/auth.yaml` under `/v1/auth`, with a valid body.
 */
interface Route {
  // #region Properties
  /**
   * Property path
   *
   * @description
   * Path of the route.
   *
   * @type {string}
   * @readonly
   */
  readonly path: string;

  /**
   * Property body
   *
   * @description
   * A body its schema accepts.
   *
   * @type {Record<string, unknown>}
   * @readonly
   */
  readonly body: Record<string, unknown>;
  // #endregion
}

/**
 * Constant ROUTES
 *
 * @description
 * Every unsafe route of `openapi/public/auth.yaml`, with a body its schema accepts.
 *
 * @type {readonly Route[]}
 */
const ROUTES: readonly Route[] = [
  { path: '/v1/auth/sign-in-methods', body: { email: CAMILLE.email } },
  {
    path: '/v1/auth/sign-up',
    body: {
      name: CAMILLE.name,
      email: CAMILLE.email,
      password: 'atelier-nord-sprint-14',
      acceptTerms: true,
    },
  },
  { path: '/v1/auth/sign-up/code', body: { email: CAMILLE.email } },
  { path: '/v1/auth/sign-up/verification', body: { email: CAMILLE.email, code: '482913' } },
  {
    path: '/v1/auth/sign-in',
    body: { email: CAMILLE.email, password: 'atelier-nord-sprint-14', rememberMe: true },
  },
  { path: '/v1/auth/sign-in/code', body: { email: CAMILLE.email } },
  { path: '/v1/auth/sign-in/code/verification', body: { email: CAMILLE.email, code: '482913' } },
  { path: '/v1/auth/sign-out', body: {} },
];

/**
 * Function post
 *
 * @description
 * Sends a request as the web application does: from the allowed origin, as JSON, with a
 * User-Agent.
 *
 * @param {RouteApplication} application - Application under test.
 * @param {string} path - Path of the route.
 * @param {object} body - JSON body.
 * @returns {request.Test} The pending request, to extend.
 */
function post(application: RouteApplication, path: string, body: object): request.Test {
  return request(application.server)
    .post(path)
    .set('Origin', ALLOWED_ORIGIN)
    .set('User-Agent', BROWSER)
    .set('Content-Type', 'application/json')
    .send(body);
}

describe('routes of /v1/auth', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;

  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Back to the implementations of `createFakeIdentity`, calls forgotten.
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await application.app.close();
  });

  describe('POST /v1/auth/sign-in-methods', () => {
    it('answers the methods identity-service offers, as the actor of no session', async () => {
      identity.discoverSignInMethods.mockResolvedValue({
        methods: [{ type: 'password' }, { type: 'email-code' }],
      });

      const response: request.Response = await post(application, '/v1/auth/sign-in-methods', {
        email: CAMILLE.email,
      });

      expectPublicResponse('post', '/v1/auth/sign-in-methods', response);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ methods: [{ type: 'password' }, { type: 'email-code' }] });
      expect(response.headers['cache-control']).toBe('no-store');
      // No entity tag of Express's own: the contract declares none on this answer.
      expect(response.headers.etag).toBeUndefined();
      expect(identity.discoverSignInMethods).toHaveBeenCalledWith({ email: CAMILLE.email });
      expect(identity.introspect).not.toHaveBeenCalled();
    });

    it('passes on a method type it does not know', async () => {
      identity.discoverSignInMethods.mockResolvedValue({
        methods: [{ type: 'password' }, { type: 'saml' }],
      });

      const response: request.Response = await post(application, '/v1/auth/sign-in-methods', {
        email: CAMILLE.email,
      });

      expectPublicResponse('post', '/v1/auth/sign-in-methods', response);
      expect(response.body).toEqual({ methods: [{ type: 'password' }, { type: 'saml' }] });
    });

    it('refuses an address that is not one, without calling identity-service', async () => {
      const response: request.Response = await post(application, '/v1/auth/sign-in-methods', {
        email: 'camille',
      });

      expectPublicResponse('post', '/v1/auth/sign-in-methods', response);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid', title: 'Bad Request' });
      expect(identity.discoverSignInMethods).not.toHaveBeenCalled();
    });
  });

  describe('POST /v1/auth/sign-up', () => {
    const body: { name: string; email: string; password: string; acceptTerms: boolean } = {
      name: CAMILLE.name,
      email: CAMILLE.email,
      password: 'atelier-nord-sprint-14',
      acceptTerms: true,
    };

    it('creates the account and answers 202 without a session', async () => {
      identity.signUp.mockResolvedValue(CODE_SENT);

      const response: request.Response = await post(application, '/v1/auth/sign-up', body);

      expectPublicResponse('post', '/v1/auth/sign-up', response);
      expect(response.status).toBe(202);
      expect(response.body).toEqual(CODE_SENT);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers.location).toBeUndefined();
      expect(identity.signUp).toHaveBeenCalledWith(body);
    });

    it.each([
      [409, 'auth.email-taken', {}, 'Un compte existe déjà avec cette adresse.'],
      [422, 'auth.terms-not-accepted', {}, 'Acceptez les conditions pour créer votre compte.'],
      [
        422,
        'auth.password-too-short',
        { minLength: 12 },
        'Le mot de passe doit compter 12 caractères minimum.',
      ],
      [
        422,
        'auth.password-compromised',
        {},
        'Ce mot de passe figure parmi des mots de passe divulgués : choisissez-en un autre.',
      ],
    ] as const)(
      'answers %i %s with the French title and the details of identity-service',
      async (status, code, details, title) => {
        identity.signUp.mockRejectedValue(identityProblem(status, code, details));

        const response: request.Response = await post(application, '/v1/auth/sign-up', body);

        expectPublicResponse('post', '/v1/auth/sign-up', response);
        expect(response.status).toBe(status);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({
          type: 'about:blank',
          title,
          status,
          code,
          ...(Object.keys(details).length === 0 ? {} : { details }),
        });
      },
    );

    it('answers 429 auth.code-throttled with Retry-After derived from resendAvailableAt', async () => {
      identity.signUp.mockRejectedValue(
        identityProblem(429, 'auth.code-throttled', {
          resendAvailableAt: '2026-11-08T13:07:21.200Z',
        }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-up', body);

      expectPublicResponse('post', '/v1/auth/sign-up', response);
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('22');
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Un code vient d’être envoyé : patientez avant d’en demander un nouveau.',
        status: 429,
        code: 'auth.code-throttled',
        details: { resendAvailableAt: '2026-11-08T13:07:21.200Z' },
      });
    });

    it('relays a validation refusal of identity-service as 400 request.invalid', async () => {
      identity.signUp.mockRejectedValue(
        identityProblem(400, 'request.invalid', {
          issues: [{ in: 'body', path: 'name', code: 'too_big', message: 'Too long' }],
        }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-up', body);

      expectPublicResponse('post', '/v1/auth/sign-up', response);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'request.invalid',
        details: { issues: [{ path: 'name' }] },
      });
      expect(response.body).not.toHaveProperty('details.service');
    });

    it('refuses a missing member before identity-service', async () => {
      const response: request.Response = await post(application, '/v1/auth/sign-up', {
        email: CAMILLE.email,
        password: 'atelier-nord-sprint-14',
      });

      expectPublicResponse('post', '/v1/auth/sign-up', response);
      expect(response.status).toBe(400);
      expect(identity.signUp).not.toHaveBeenCalled();
    });

    it('never writes the password into a log line', async () => {
      identity.signUp.mockResolvedValue(CODE_SENT);

      await post(application, '/v1/auth/sign-up', body);

      expect(application.logLines.join('\n')).not.toContain(body.password);
    });
  });

  describe('POST /v1/auth/sign-up/code', () => {
    it('answers 202 with the code timings', async () => {
      identity.resendSignUpCode.mockResolvedValue(CODE_SENT);

      const response: request.Response = await post(application, '/v1/auth/sign-up/code', {
        email: CAMILLE.email,
      });

      expectPublicResponse('post', '/v1/auth/sign-up/code', response);
      expect(response.status).toBe(202);
      expect(response.body).toEqual(CODE_SENT);
      expect(identity.resendSignUpCode).toHaveBeenCalledWith({ email: CAMILLE.email });
    });

    it('answers 429 auth.code-throttled with Retry-After', async () => {
      identity.resendSignUpCode.mockRejectedValue(
        identityProblem(429, 'auth.code-throttled', {
          resendAvailableAt: '2026-11-08T13:07:30Z',
        }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-up/code', {
        email: CAMILLE.email,
      });

      expectPublicResponse('post', '/v1/auth/sign-up/code', response);
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('30');
    });
  });

  describe.each([
    ['/v1/auth/sign-up/verification', 'verifySignUp'],
    ['/v1/auth/sign-in/code/verification', 'signInWithCode'],
  ] as const)('POST %s', (path, operation) => {
    it('signs in with a session cookie that ends with the browser', async () => {
      identity[operation].mockResolvedValue(issuedSession(false));

      const response: request.Response = await post(application, path, {
        email: CAMILLE.email,
        code: '482913',
      })
        .set('Cookie', '__Host-cw_session=stale-token')
        .set('X-Forwarded-For', '86.247.12.30');

      expectPublicResponse('post', path, response);
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toEqual([
        '__Host-cw_session=new-session-token-0123456789; Path=/; Secure; HttpOnly; SameSite=Lax',
      ]);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual({
        user: CAMILLE,
        session: { id: CAMILLE_SESSION.sessionId, expiresAt: '2026-11-09T01:07:00Z' },
      });
      expect(JSON.stringify(response.body)).not.toContain('new-session-token');
      expect(identity[operation]).toHaveBeenCalledWith({
        email: CAMILLE.email,
        code: '482913',
        rememberMe: false,
        client: { ipAddress: '86.247.12.30', userAgent: BROWSER },
      });
      expect(identity.introspect).not.toHaveBeenCalled();
    });

    it('sets Max-Age to the seconds left until the end of a persistent session', async () => {
      identity[operation].mockResolvedValue(issuedSession(true));

      const response: request.Response = await post(application, path, {
        email: CAMILLE.email,
        code: '482913',
        rememberMe: true,
      });

      expectPublicResponse('post', path, response);
      expect(response.headers['set-cookie']).toEqual([
        '__Host-cw_session=new-session-token-0123456789; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000',
      ]);
    });

    it.each(['auth.code-invalid', 'auth.code-expired'])(
      'answers 422 %s with the one French line of a refused code',
      async (code) => {
        identity[operation].mockRejectedValue(identityProblem(422, code));

        const response: request.Response = await post(application, path, {
          email: CAMILLE.email,
          code: '000000',
        });

        expectPublicResponse('post', path, response);
        expect(response.status).toBe(422);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.body).toEqual({
          type: 'about:blank',
          title: 'Code incorrect ou expiré : vérifiez le dernier e-mail reçu.',
          status: 422,
          code,
        });
      },
    );

    it('refuses a code that is not 6 digits before identity-service', async () => {
      const response: request.Response = await post(application, path, {
        email: CAMILLE.email,
        code: '482 913',
      });

      expectPublicResponse('post', path, response);
      expect(response.status).toBe(400);
      expect(identity[operation]).not.toHaveBeenCalled();
    });

    it('never writes the code or the session token into a log line', async () => {
      identity[operation].mockResolvedValue(issuedSession(false));

      await post(application, path, { email: CAMILLE.email, code: '482913' });

      const logs: string = application.logLines.join('\n');
      expect(logs).not.toContain('482913');
      expect(logs).not.toContain('new-session-token');
    });
  });

  describe('POST /v1/auth/sign-in', () => {
    const body: { email: string; password: string; rememberMe: boolean } = {
      email: CAMILLE.email,
      password: 'atelier-nord-sprint-14',
      rememberMe: true,
    };

    it('signs in with a persistent session cookie, and reads the browser behind one proxy hop', async () => {
      identity.signInWithPassword.mockResolvedValue(issuedSession(true));

      const response: request.Response = await post(application, '/v1/auth/sign-in', body)
        // Traefik appends the address it saw; the entries before it are written by the client.
        .set('X-Forwarded-For', '203.0.113.9, 86.247.12.30');

      expectPublicResponse('post', '/v1/auth/sign-in', response);
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toEqual([
        '__Host-cw_session=new-session-token-0123456789; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000',
      ]);
      expect(response.body).toEqual({
        user: CAMILLE,
        session: { id: CAMILLE_SESSION.sessionId, expiresAt: '2026-12-08T13:07:00Z' },
      });
      expect(identity.signInWithPassword).toHaveBeenCalledWith({
        ...body,
        client: { ipAddress: '86.247.12.30', userAgent: BROWSER },
      });
    });

    it('sends the socket address and no User-Agent when there is no proxy and no header', async () => {
      identity.signInWithPassword.mockResolvedValue(issuedSession(false));

      const response: request.Response = await request(application.server)
        .post('/v1/auth/sign-in')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Content-Type', 'application/json')
        .send({ email: CAMILLE.email, password: 'atelier-nord-sprint-14' });

      expect(response.status).toBe(200);
      expect(identity.signInWithPassword).toHaveBeenCalledWith({
        email: CAMILLE.email,
        password: 'atelier-nord-sprint-14',
        rememberMe: false,
        client: { ipAddress: '127.0.0.1', userAgent: null },
      });
    });

    it('cuts a User-Agent longer than the internal contract allows', async () => {
      identity.signInWithPassword.mockResolvedValue(issuedSession(false));

      await post(application, '/v1/auth/sign-in', body).set('User-Agent', 'a'.repeat(1500));

      expect(identity.signInWithPassword.mock.calls[0]?.[0].client.userAgent).toBe(
        'a'.repeat(1024),
      );
    });

    it('ignores a stale session cookie: the route carries no session', async () => {
      identity.signInWithPassword.mockResolvedValue(issuedSession(true));

      const response: request.Response = await post(application, '/v1/auth/sign-in', body).set(
        'Cookie',
        '__Host-cw_session=revoked-token',
      );

      expect(response.status).toBe(200);
      expect(identity.introspect).not.toHaveBeenCalled();
    });

    it('answers 422 auth.invalid-credentials with the attempts left', async () => {
      identity.signInWithPassword.mockRejectedValue(
        identityProblem(422, 'auth.invalid-credentials', { remainingAttempts: 3 }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-in', body);

      expectPublicResponse('post', '/v1/auth/sign-in', response);
      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'E-mail ou mot de passe incorrect.',
        status: 422,
        code: 'auth.invalid-credentials',
        details: { remainingAttempts: 3 },
      });
    });

    it('answers 429 auth.account-locked with Retry-After derived from lockedUntil', async () => {
      identity.signInWithPassword.mockRejectedValue(
        identityProblem(429, 'auth.account-locked', { lockedUntil: '2026-11-08T13:22:00Z' }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-in', body);

      expectPublicResponse('post', '/v1/auth/sign-in', response);
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('900');
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Trop de tentatives échouées.',
        status: 429,
        code: 'auth.account-locked',
        details: { lockedUntil: '2026-11-08T13:22:00Z' },
      });
    });

    it('answers 403 auth.email-not-verified for an unverified address', async () => {
      identity.signInWithPassword.mockRejectedValue(
        identityProblem(403, 'auth.email-not-verified'),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-in', body);

      expectPublicResponse('post', '/v1/auth/sign-in', response);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Confirmez votre adresse e-mail pour vous connecter.',
        status: 403,
        code: 'auth.email-not-verified',
      });
    });

    it.each(['auth.actor-not-allowed', 'auth.issuer-not-allowed'])(
      'answers a refused internal token (403 %s) as 503 upstream.unauthorized',
      async (code) => {
        identity.signInWithPassword.mockRejectedValue(identityProblem(403, code));

        const response: request.Response = await post(application, '/v1/auth/sign-in', body);

        expectPublicResponse('post', '/v1/auth/sign-in', response);
        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          title: 'Service Unavailable',
          code: 'upstream.unauthorized',
          details: { service: 'identity-service' },
        });
      },
    );

    it('answers 503 as the internal HTTP client reports it', async () => {
      identity.signInWithPassword.mockRejectedValue(identityUnavailable('circuit-open'));

      const response: request.Response = await post(application, '/v1/auth/sign-in', body);

      expectPublicResponse('post', '/v1/auth/sign-in', response);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        code: 'upstream.circuit-open',
        details: { service: 'identity-service' },
      });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it.each([
      [404, 'user.not-found'],
      [409, 'auth.email-taken'],
      [422, 'auth.code-invalid'],
      [429, 'auth.code-throttled'],
    ] as const)(
      'answers a client error the route does not declare (%i %s) as 503 upstream.failed, never as is',
      async (status, code) => {
        identity.signInWithPassword.mockRejectedValue(identityProblem(status, code));

        const response: request.Response = await post(application, '/v1/auth/sign-in', body);

        expectPublicResponse('post', '/v1/auth/sign-in', response);
        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          code: 'upstream.failed',
          details: { service: 'identity-service' },
        });
        expect(JSON.stringify(response.body)).not.toContain(code);
      },
    );

    it('never writes the password into a log line, even on a failure', async () => {
      identity.signInWithPassword.mockRejectedValue(
        identityProblem(422, 'auth.invalid-credentials', { remainingAttempts: 4 }),
      );

      await post(application, '/v1/auth/sign-in', body);

      expect(application.logLines.join('\n')).not.toContain(body.password);
    });
  });

  describe('POST /v1/auth/sign-in/code', () => {
    it('answers 202 with the code timings', async () => {
      identity.requestSignInCode.mockResolvedValue(CODE_SENT);

      const response: request.Response = await post(application, '/v1/auth/sign-in/code', {
        email: CAMILLE.email,
      });

      expectPublicResponse('post', '/v1/auth/sign-in/code', response);
      expect(response.status).toBe(202);
      expect(response.body).toEqual(CODE_SENT);
      expect(identity.requestSignInCode).toHaveBeenCalledWith({ email: CAMILLE.email });
    });

    it('answers 429 auth.code-throttled with Retry-After of at least one second', async () => {
      identity.requestSignInCode.mockRejectedValue(
        identityProblem(429, 'auth.code-throttled', {
          resendAvailableAt: '2026-11-08T13:06:59Z',
        }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-in/code', {
        email: CAMILLE.email,
      });

      expectPublicResponse('post', '/v1/auth/sign-in/code', response);
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('1');
    });
  });

  describe('POST /v1/auth/sign-out', () => {
    const cleared: string[] = [
      '__Host-cw_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ];

    it('revokes the session of the cookie as its user and clears the cookie', async () => {
      identity.revokeSession.mockResolvedValue(undefined);

      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        `__Host-cw_session=${CAMILLE_TOKEN}`,
      );

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(response.headers['set-cookie']).toEqual(cleared);
      expect(identity.introspect).toHaveBeenCalledWith(CAMILLE_TOKEN);
      expect(identity.revokeSession).toHaveBeenCalledWith(CAMILLE_SESSION.sessionId);
    });

    it('clears the cookie and answers 204 without a cookie, calling nothing', async () => {
      const response: request.Response = await post(application, '/v1/auth/sign-out', {});

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(204);
      expect(response.headers['set-cookie']).toEqual(cleared);
      expect(identity.introspect).not.toHaveBeenCalled();
      expect(identity.revokeSession).not.toHaveBeenCalled();
    });

    it('clears the cookie and answers 204 for a session that already ended', async () => {
      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        '__Host-cw_session=revoked-token',
      );

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(204);
      expect(response.headers['set-cookie']).toEqual(cleared);
      expect(identity.revokeSession).not.toHaveBeenCalled();
    });

    it('answers 204 when identity-service no longer finds the session', async () => {
      identity.revokeSession.mockRejectedValue(identityProblem(404, 'session.not-found'));

      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        `__Host-cw_session=${CAMILLE_TOKEN}`,
      );

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(204);
      expect(response.headers['set-cookie']).toEqual(cleared);
    });

    it('answers an internal 400 of the revocation as 503 upstream.failed: the browser sent no path', async () => {
      identity.revokeSession.mockRejectedValue(
        identityProblem(400, 'request.invalid', {
          issues: [
            { in: 'param', path: 'sessionId', code: 'invalid_format', message: 'Invalid UUID' },
          ],
        }),
      );

      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        `__Host-cw_session=${CAMILLE_TOKEN}`,
      );

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'upstream.failed' });
      expect(JSON.stringify(response.body)).not.toContain('sessionId');
    });

    it('answers 503 when the introspection of the sign-out is refused, keeping the cookie', async () => {
      identity.introspect.mockRejectedValue(identityProblem(403, 'auth.actor-not-allowed'));

      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        `__Host-cw_session=${CAMILLE_TOKEN}`,
      );

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'upstream.unauthorized' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('answers 503 and keeps the cookie when identity-service cannot revoke', async () => {
      identity.revokeSession.mockRejectedValue(identityUnavailable());

      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        `__Host-cw_session=${CAMILLE_TOKEN}`,
      );

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(503);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('refuses a body with members: the contract allows the empty object only', async () => {
      const response: request.Response = await post(application, '/v1/auth/sign-out', {
        everywhere: true,
      });

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(400);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('refuses a cross-site sign-out before the introspection', async () => {
      const response: request.Response = await request(application.server)
        .post('/v1/auth/sign-out')
        .set('Origin', 'https://evil.test')
        .set('Cookie', `__Host-cw_session=${CAMILLE_TOKEN}`)
        .set('Content-Type', 'application/json')
        .send({});

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'auth.csrf-rejected',
        detail: 'Cross-site request refused.',
      });
      expect(identity.introspect).not.toHaveBeenCalled();
      expect(identity.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe.each(ROUTES)('cross-site check of POST $path', ({ path, body }: Route) => {
    it.each([
      ['no Origin', undefined],
      ['another origin', 'https://evil.test'],
      ['a lookalike origin', 'https://app.cadenway.test.evil.test'],
      ['an origin with a path', `${ALLOWED_ORIGIN}/`],
      ['the opaque origin', 'null'],
    ])('refuses %s with 403 auth.csrf-rejected before the route runs', async (_label, origin) => {
      let pending: request.Test = request(application.server)
        .post(path)
        .set('Content-Type', 'application/json');
      if (origin !== undefined) {
        pending = pending.set('Origin', origin);
      }

      const response: request.Response = await pending.send(body);

      // Not checked with expectPublicResponse: auth.yaml declares this 403 on the sign-out (and a
      // 403 on the sign-in) only, while the login cross-site decision of docs/integration.md
      // applies the check to every unsafe route of the authentication. The contract must close
      // the gap.
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'auth.csrf-rejected', title: 'Forbidden' });
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.headers['cache-control']).toBe('no-store');
      for (const mock of Object.values(identity)) {
        expect(mock).not.toHaveBeenCalled();
      }
    });

    it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'])(
      'refuses Content-Type %s with 403 auth.csrf-rejected',
      async (contentType) => {
        const response: request.Response = await request(application.server)
          .post(path)
          .set('Origin', ALLOWED_ORIGIN)
          .set('Content-Type', contentType)
          .send(JSON.stringify(body));

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: 'auth.csrf-rejected' });
      },
    );

    it('accepts the website origin and a JSON media type with parameters', async () => {
      const response: request.Response = await request(application.server)
        .post(path)
        .set('Origin', WEBSITE_ORIGIN)
        .set('Content-Type', 'application/json; charset=utf-8')
        .send(JSON.stringify(body));

      // The fake answers no call, so a route that calls identity-service fails past the check.
      expect(response.body).not.toMatchObject({ code: 'auth.csrf-rejected' });
    });
  });
});
