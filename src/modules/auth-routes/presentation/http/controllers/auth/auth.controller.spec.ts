import type { SessionIssued } from '@cadenway/contracts/types/internal/identity-service';

import type { IdentitySignIn } from '../../../../../../clients/identity-service.client.js';
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
import {
  ALLOWED_ORIGIN,
  WEBSITE_ORIGIN,
} from '../../../../../../../tests/support/test-environment.js';

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
 * Function signedIn
 *
 * @description
 * Answer of identity-service to a sign-in by password or by code that opens the session.
 *
 * @param {SessionIssued} issued - The session opened.
 * @returns {IdentitySignIn} The outcome of the sign-in.
 */
function signedIn(issued: SessionIssued): IdentitySignIn {
  return { outcome: 'signed-in', session: issued };
}

/**
 * Function resolveCodeSignIn
 *
 * @description
 * Gives the verification of a sign-up code or of a sign-in code the session it opens: the first
 * answers the session alone, the second the outcome of a sign-in.
 *
 * @param {FakeIdentity} identity - The fake of identity-service.
 * @param {'verifySignUp' | 'signInWithCode'} operation - The method of the client.
 * @param {SessionIssued} issued - The session opened.
 */
function resolveCodeSignIn(
  identity: FakeIdentity,
  operation: 'verifySignUp' | 'signInWithCode',
  issued: SessionIssued,
): void {
  if (operation === 'verifySignUp') {
    identity.verifySignUp.mockResolvedValue(issued);
  } else {
    identity.signInWithCode.mockResolvedValue(signedIn(issued));
  }
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
  { path: '/v1/auth/password-reset', body: { email: CAMILLE.email } },
  { path: '/v1/auth/password-reset/inspection', body: { token: 'reset-token-of-the-link' } },
  {
    path: '/v1/auth/password-reset/confirmation',
    body: { token: 'reset-token-of-the-link', newPassword: 'nord-atelier-sprint-15' },
  },
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
      resolveCodeSignIn(identity, operation, issuedSession(false));

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
      resolveCodeSignIn(identity, operation, issuedSession(true));

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
      resolveCodeSignIn(identity, operation, issuedSession(false));

      await post(application, path, { email: CAMILLE.email, code: '482913' });

      const logs: string = application.logLines.join('\n');
      expect(logs).not.toContain('482913');
      expect(logs).not.toContain('new-session-token');
    });
  });

  describe('POST /v1/auth/sign-up/verification and the password of the sign-up', () => {
    // Spaces around it and a non-ASCII character: forwarded as typed, never trimmed or normalized.
    const password: string = '  Atelier Nord, sprint 14 – ébauche  ';
    const body: { email: string; code: string; password: string } = {
      email: CAMILLE.email,
      code: '482913',
      password,
    };

    it('forwards the password of the sign-up form to identity-service unchanged', async () => {
      identity.verifySignUp.mockResolvedValue(issuedSession(false));

      const response: request.Response = await post(
        application,
        '/v1/auth/sign-up/verification',
        body,
      ).set('X-Forwarded-For', '86.247.12.30');

      expectPublicResponse('post', '/v1/auth/sign-up/verification', response);
      expect(response.status).toBe(200);
      expect(identity.verifySignUp).toHaveBeenCalledWith({
        email: CAMILLE.email,
        code: '482913',
        rememberMe: false,
        password,
        client: { ipAddress: '86.247.12.30', userAgent: BROWSER },
      });
      expect(JSON.stringify(response.body)).not.toContain(password);
    });

    it('sends no password member when the browser sent none', async () => {
      identity.verifySignUp.mockResolvedValue(issuedSession(false));

      const response: request.Response = await post(application, '/v1/auth/sign-up/verification', {
        email: CAMILLE.email,
        code: '482913',
      });

      expectPublicResponse('post', '/v1/auth/sign-up/verification', response);
      expect(response.status).toBe(200);
      expect(identity.verifySignUp).toHaveBeenCalledTimes(1);
      expect(identity.verifySignUp.mock.calls[0]?.[0]).not.toHaveProperty('password');
    });

    it('answers 422 auth.sign-up-replaced with its French title and no session', async () => {
      identity.verifySignUp.mockRejectedValue(identityProblem(422, 'auth.sign-up-replaced'));

      const response: request.Response = await post(
        application,
        '/v1/auth/sign-up/verification',
        body,
      );

      expectPublicResponse('post', '/v1/auth/sign-up/verification', response);
      expect(response.status).toBe(422);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.body).toEqual({
        type: 'about:blank',
        title:
          'Une autre inscription a été faite avec cette adresse : recommencez votre inscription.',
        status: 422,
        code: 'auth.sign-up-replaced',
      });
    });

    it.each([
      ['longer than 256 characters', 'a'.repeat(257)],
      ['not a string', 482913],
      ['null', null],
    ])('refuses a password that is %s with 400 before identity-service', async (_label, value) => {
      const response: request.Response = await post(application, '/v1/auth/sign-up/verification', {
        ...body,
        password: value,
      });

      expectPublicResponse('post', '/v1/auth/sign-up/verification', response);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'request.invalid',
        details: { issues: [{ in: 'body', path: 'password' }] },
      });
      expect(identity.verifySignUp).not.toHaveBeenCalled();
    });

    it('never writes the password into a log line or an error, whatever the outcome', async () => {
      const tooLong: string = password.repeat(8).slice(0, 257);
      identity.verifySignUp
        .mockResolvedValueOnce(issuedSession(false))
        .mockRejectedValueOnce(identityProblem(422, 'auth.sign-up-replaced'))
        .mockRejectedValueOnce(identityProblem(400, 'request.invalid', { issues: [] }))
        .mockRejectedValueOnce(identityUnavailable('timeout'))
        .mockRejectedValueOnce(new Error('Unexpected failure of the call.'));

      const sent: readonly object[] = [
        body,
        body,
        body,
        body,
        body,
        { ...body, password: tooLong },
      ];
      const responses: request.Response[] = [];
      for (const each of sent) {
        responses.push(await post(application, '/v1/auth/sign-up/verification', each));
      }

      expect(responses.map((response) => response.status)).toEqual([200, 422, 400, 503, 500, 400]);
      for (const response of responses) {
        // The unexpected error answers 500, which no operation declares: its body is not checked.
        if (response.status !== 500) {
          expectPublicResponse('post', '/v1/auth/sign-up/verification', response);
        }
        expect(response.text).not.toContain(password.trim());
      }
      expect(application.logLines.join('\n')).not.toContain(password.trim());
    });

    // The message of `JSON.parse` quotes the ten characters around an unexpected token, here the
    // start of the password. Since `@cadenway/nest-common` 0.4.2 the kit answers a malformed body
    // with a fixed `400 request.invalid` that quotes nothing of it: neither the response nor the
    // log lines may hold a fragment of the password.
    it.each([
      ['an unquoted value', `{"code":"482913","password":${password.trim()}}`],
      ['a single-quoted value', `{"code":"482913","password":'${password.trim()}'}`],
    ])('refuses a body that is not JSON (%s) without echoing it', async (_label, text) => {
      const response: request.Response = await request(application.server)
        .post('/v1/auth/sign-up/verification')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Content-Type', 'application/json')
        .send(text);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
      expectPublicResponse('post', '/v1/auth/sign-up/verification', response);
      expect(response.text).not.toContain(password.trim());
      expect(response.text).not.toContain(password.trim().slice(0, 8));
      expect(identity.verifySignUp).not.toHaveBeenCalled();
      const logs: string = application.logLines.join('\n');
      expect(logs).not.toContain(password.trim());
      expect(logs).not.toContain(password.trim().slice(0, 8));
    });
  });

  describe('POST /v1/auth/sign-in', () => {
    const body: { email: string; password: string; rememberMe: boolean } = {
      email: CAMILLE.email,
      password: 'atelier-nord-sprint-14',
      rememberMe: true,
    };

    it('signs in with a persistent session cookie, and reads the browser behind one proxy hop', async () => {
      identity.signInWithPassword.mockResolvedValue(signedIn(issuedSession(true)));

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
      identity.signInWithPassword.mockResolvedValue(signedIn(issuedSession(false)));

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
      identity.signInWithPassword.mockResolvedValue(signedIn(issuedSession(false)));

      await post(application, '/v1/auth/sign-in', body).set('User-Agent', 'a'.repeat(1500));

      expect(identity.signInWithPassword.mock.calls[0]?.[0].client.userAgent).toBe(
        'a'.repeat(1024),
      );
    });

    it('ignores a stale session cookie: the route carries no session', async () => {
      identity.signInWithPassword.mockResolvedValue(signedIn(issuedSession(true)));

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

  describe('POST /v1/auth/sign-in/code/verification and the refusals of the sign-up', () => {
    it('answers auth.sign-up-replaced, which its contract does not declare, as 503 upstream.failed', async () => {
      identity.signInWithCode.mockRejectedValue(identityProblem(422, 'auth.sign-up-replaced'));

      const response: request.Response = await post(
        application,
        '/v1/auth/sign-in/code/verification',
        { email: CAMILLE.email, code: '482913' },
      );

      expectPublicResponse('post', '/v1/auth/sign-in/code/verification', response);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        title: 'Service Unavailable',
        code: 'upstream.failed',
        details: { service: 'identity-service' },
      });
      expect(JSON.stringify(response.body)).not.toContain('sign-up-replaced');
      expect(response.headers['set-cookie']).toBeUndefined();
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

      expectPublicResponse('post', path, response);
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

  describe.each(ROUTES.filter((route: Route) => route.path !== '/v1/auth/sign-out'))(
    'limit per client address of POST $path, which carries no credential',
    ({ path, body }: Route) => {
      it('counts the request on a pseudonym of the address Traefik saw, never on the address', async () => {
        application.logLines.length = 0;

        await post(application, path, body).set('X-Forwarded-For', '198.51.100.23, 86.247.12.30');
        await post(application, path, body).set('X-Forwarded-For', '86.247.12.30');
        await post(application, path, body).set('X-Forwarded-For', '86.247.12.31');

        const keys: string[] = application.anonymousCounter.consume.mock.calls.map(
          ([key]: [string]) => key,
        );
        expect(keys).toHaveLength(3);
        expect(keys.every((key: string) => /^anonymous:[\w-]{22}$/u.test(key))).toBe(true);
        // The entry the client wrote is not its address: only the hop Traefik added counts.
        expect(keys[0]).toBe(keys[1]);
        expect(keys[2]).not.toBe(keys[0]);
        expect(keys.join('\n')).not.toMatch(/86\.247|198\.51/u);
        expect(application.counter.consume).not.toHaveBeenCalled();
        const logs: string = application.logLines.join('\n');
        expect(logs).not.toContain('86.247.12.30');
        expect(logs).not.toContain(keys[0]?.slice('anonymous:'.length));
      });

      it('answers 429 rate-limit.exceeded with Retry-After beyond the quota of the address, calling nothing', async () => {
        application.anonymousCounter.consume.mockResolvedValue({
          allowed: false,
          retryAfterSeconds: 41,
        });

        const response: request.Response = await post(application, path, body).set(
          'X-Forwarded-For',
          '86.247.12.30',
        );

        expectPublicResponse('post', path, response);
        expect(response.status).toBe(429);
        expect(response.body).toEqual({
          type: 'about:blank',
          title: 'Trop de requêtes : réessayez dans un instant.',
          status: 429,
          code: 'rate-limit.exceeded',
          detail: 'Too many requests from this client; retry after the delay of Retry-After.',
        });
        expect(response.headers['retry-after']).toBe('41');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['set-cookie']).toBeUndefined();
        for (const mock of Object.values(identity)) {
          expect(mock).not.toHaveBeenCalled();
        }
      });

      it('counts a request whose body is invalid too: the limit runs before the validation', async () => {
        const response: request.Response = await post(application, path, { unexpected: 1 });

        expect(response.status).toBe(400);
        expect(application.anonymousCounter.consume).toHaveBeenCalledTimes(1);
      });

      it('neither reads nor counts the failed bearer tokens of the address: the route ignores a bearer token', async () => {
        await post(application, path, body).set('Authorization', 'Bearer not-a-token');

        expect(application.bearerFailureCounter.peek).not.toHaveBeenCalled();
        expect(application.bearerFailureCounter.consume).not.toHaveBeenCalled();
        expect(application.anonymousCounter.consume).toHaveBeenCalledTimes(1);
      });
    },
  );

  describe('limit of POST /v1/auth/sign-out', () => {
    it('counts a sign-out without an active session on the pseudonym of its address', async () => {
      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        '__Host-cw_session=revoked-token',
      );

      expect(response.status).toBe(204);
      expect(application.anonymousCounter.consume).toHaveBeenCalledTimes(1);
      expect(application.counter.consume).not.toHaveBeenCalled();
    });

    it('counts a sign-out with an active session on the session only', async () => {
      identity.revokeSession.mockResolvedValue(undefined);
      application.anonymousCounter.consume.mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 41,
      });

      const response: request.Response = await post(application, '/v1/auth/sign-out', {}).set(
        'Cookie',
        `__Host-cw_session=${CAMILLE_TOKEN}`,
      );

      expect(response.status).toBe(204);
      expect(application.counter.consume).toHaveBeenCalledWith(
        `session:${CAMILLE_SESSION.sessionId}`,
      );
      expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
    });

    it('answers 429 to a sign-out without a session beyond the quota of the address, keeping the cookie', async () => {
      application.anonymousCounter.consume.mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 8,
      });

      const response: request.Response = await post(application, '/v1/auth/sign-out', {});

      expectPublicResponse('post', '/v1/auth/sign-out', response);
      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({ code: 'rate-limit.exceeded' });
      expect(response.headers['retry-after']).toBe('8');
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });
});

/**
 * Constant RESET_TOKEN
 *
 * @description
 * Token of a password reset link in the tests: a secret that must never reach a log line.
 *
 * @type {string}
 */
const RESET_TOKEN: string = 'reset-token-0123456789abcdefghijklmnopqrstu';

/**
 * Constant NEW_PASSWORD
 *
 * @description
 * New password chosen with the link: a secret that must never reach a log line.
 *
 * @type {string}
 */
const NEW_PASSWORD: string = 'nord-atelier-sprint-15-secret';

/**
 * Constant PASSWORD
 *
 * @description
 * Password of the sign-ins of these tests: a secret that must never reach a log line.
 *
 * @type {string}
 */
const PASSWORD: string = 'atelier-nord-sprint-14-secret';

/**
 * Constant BROWSER_CLIENT
 *
 * @description
 * The `client` the gateway sends for a request from the address Traefik saw with the test
 * User-Agent.
 *
 * @type {{ ipAddress: string; userAgent: string }}
 */
const BROWSER_CLIENT: { ipAddress: string; userAgent: string } = {
  ipAddress: '86.247.12.30',
  userAgent: BROWSER,
};

/**
 * Constant BROWSER_HEADERS
 *
 * @description
 * Headers of a request from the browser of the tests, one proxy hop away.
 *
 * @type {Readonly<Record<string, string>>}
 */
const BROWSER_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent': BROWSER,
  'X-Forwarded-For': BROWSER_CLIENT.ipAddress,
};

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
 * Constant LINK
 *
 * @description
 * Answer of identity-service to the inspection of a usable link.
 *
 * @type {{ email: string; expiresAt: string; sessionCount: number }}
 */
const LINK: { email: string; expiresAt: string; sessionCount: number } = {
  email: CAMILLE.email,
  expiresAt: '2026-11-09T13:40:00Z',
  sessionCount: 3,
};

/**
 * Constant RECOVERY_CASES
 *
 * @description
 * The success and every declared error of the password reset.
 *
 * @type {readonly RouteCase[]}
 */
const RECOVERY_CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/auth/password-reset asks for a link as nobody, with the browser, answering 202',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: 'none',
    body: { email: CAMILLE.email },
    headers: BROWSER_HEADERS,
    arrange: ({ identity }) =>
      identity.requestPasswordReset.mockResolvedValue({
        email: CAMILLE.email,
        expiresAt: '2026-11-09T13:40:00Z',
        resendAvailableAt: '2026-11-09T13:10:45Z',
      }),
    status: 202,
    check: (response, { identity, anonymousCounter }) => {
      expect(response.body).toEqual({
        email: CAMILLE.email,
        expiresAt: '2026-11-09T13:40:00Z',
        resendAvailableAt: '2026-11-09T13:10:45Z',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(identity.requestPasswordReset).toHaveBeenCalledWith({
        email: CAMILLE.email,
        client: BROWSER_CLIENT,
      });
      expect(anonymousCounter.consume).toHaveBeenCalledTimes(1);
    },
  },
  {
    name: 'POST /v1/auth/password-reset ignores a stale session cookie: the route carries no session',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: { cookie: 'stale' },
    body: { email: CAMILLE.email },
    arrange: ({ identity }) =>
      identity.requestPasswordReset.mockResolvedValue({
        email: CAMILLE.email,
        expiresAt: '2026-11-09T13:40:00Z',
        resendAvailableAt: '2026-11-09T13:10:45Z',
      }),
    status: 202,
    check: (_response, { identity }) => {
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/auth/password-reset refuses an address that is not one',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: 'none',
    body: { email: 'camille' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/auth/password-reset refuses another origin',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: 'none',
    origin: 'https://evil.test',
    body: { email: CAMILLE.email },
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'POST /v1/auth/password-reset relays 429 auth.reset-throttled with Retry-After',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: 'none',
    body: { email: CAMILLE.email },
    arrange: ({ identity }) =>
      identity.requestPasswordReset.mockRejectedValue(
        identityProblem(429, 'auth.reset-throttled', { resendAvailableAt: inSeconds(45) }),
      ),
    status: 429,
    code: 'auth.reset-throttled',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Un lien vient d’être envoyé : patientez avant d’en demander un nouveau.',
      });
      const body = response.body as { details?: { resendAvailableAt?: unknown } };
      expect(typeof body.details?.resendAvailableAt).toBe('string');
      expectRetryAfterAtMost(response, 45);
    },
  },
  {
    name: 'POST /v1/auth/password-reset answers 429 beyond the quota of the address',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: 'none',
    body: { email: CAMILLE.email },
    arrange: ({ anonymousCounter }) =>
      anonymousCounter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 }),
    status: 429,
    code: 'rate-limit.exceeded',
    check: (response, { identity }) => {
      expect(response.headers['retry-after']).toBe('12');
      expect(identity.requestPasswordReset).not.toHaveBeenCalled();
    },
  },
  {
    name: 'POST /v1/auth/password-reset answers 503 when identity-service cannot answer',
    method: 'post',
    path: '/v1/auth/password-reset',
    url: '/v1/auth/password-reset',
    credential: 'none',
    body: { email: CAMILLE.email },
    arrange: ({ identity }) =>
      identity.requestPasswordReset.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
  {
    name: 'POST /v1/auth/password-reset/inspection reads the account of the link with the token of the body',
    method: 'post',
    path: '/v1/auth/password-reset/inspection',
    url: '/v1/auth/password-reset/inspection',
    credential: 'none',
    body: { token: RESET_TOKEN },
    arrange: ({ identity }) => identity.inspectPasswordResetLink.mockResolvedValue({ ...LINK }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(LINK);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.inspectPasswordResetLink).toHaveBeenCalledWith({ token: RESET_TOKEN });
    },
  },
  {
    name: 'POST /v1/auth/password-reset/inspection refuses an empty token',
    method: 'post',
    path: '/v1/auth/password-reset/inspection',
    url: '/v1/auth/password-reset/inspection',
    credential: 'none',
    body: { token: '' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/auth/password-reset/inspection refuses a form post',
    method: 'post',
    path: '/v1/auth/password-reset/inspection',
    url: '/v1/auth/password-reset/inspection',
    credential: 'none',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${RESET_TOKEN}`,
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'POST /v1/auth/password-reset/inspection relays 422 auth.reset-link-expired',
    method: 'post',
    path: '/v1/auth/password-reset/inspection',
    url: '/v1/auth/password-reset/inspection',
    credential: 'none',
    body: { token: RESET_TOKEN },
    arrange: ({ identity }) =>
      identity.inspectPasswordResetLink.mockRejectedValue(
        identityProblem(422, 'auth.reset-link-expired'),
      ),
    status: 422,
    code: 'auth.reset-link-expired',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Ce lien a expiré',
        status: 422,
        code: 'auth.reset-link-expired',
      });
    },
  },
  {
    name: 'POST /v1/auth/password-reset/inspection answers 429 beyond the quota of the address',
    method: 'post',
    path: '/v1/auth/password-reset/inspection',
    url: '/v1/auth/password-reset/inspection',
    credential: 'none',
    body: { token: RESET_TOKEN },
    arrange: ({ anonymousCounter }) =>
      anonymousCounter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/auth/password-reset/inspection answers 503 when identity-service cannot answer',
    method: 'post',
    path: '/v1/auth/password-reset/inspection',
    url: '/v1/auth/password-reset/inspection',
    credential: 'none',
    body: { token: RESET_TOKEN },
    arrange: ({ identity }) =>
      identity.inspectPasswordResetLink.mockRejectedValue(identityUnavailable('timeout')),
    status: 503,
    code: 'upstream.timeout',
  },
  {
    name: 'POST /v1/auth/password-reset/confirmation sets the password, closing the other sessions by default, without signing in',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD },
    headers: BROWSER_HEADERS,
    arrange: ({ identity }) =>
      identity.confirmPasswordReset.mockResolvedValue({
        email: CAMILLE.email,
        closedSessionCount: 3,
      }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ email: CAMILLE.email, closedSessionCount: 3 });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(identity.confirmPasswordReset).toHaveBeenCalledWith({
        token: RESET_TOKEN,
        newPassword: NEW_PASSWORD,
        closeOtherSessions: true,
        client: BROWSER_CLIENT,
      });
    },
  },
  {
    name: 'POST /v1/auth/password-reset/confirmation keeps the other sessions when asked to',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD, closeOtherSessions: false },
    arrange: ({ identity }) =>
      identity.confirmPasswordReset.mockResolvedValue({
        email: CAMILLE.email,
        closedSessionCount: 0,
      }),
    status: 200,
    check: (_response, { identity }) => {
      expect(identity.confirmPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ closeOtherSessions: false }),
      );
    },
  },
  {
    name: 'POST /v1/auth/password-reset/confirmation refuses a body without the new password',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/auth/password-reset/confirmation refuses a request without Origin',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    origin: null,
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD },
    status: 403,
    code: 'auth.csrf-rejected',
  },
  ...(
    [
      ['auth.reset-link-expired', {}, 'Ce lien a expiré'],
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
    ] as const
  ).map(([code, details, title]): RouteCase => ({
    name: `POST /v1/auth/password-reset/confirmation relays 422 ${code}`,
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.confirmPasswordReset.mockRejectedValue(identityProblem(422, code, details)),
    status: 422,
    code,
    check: (response) => {
      expect(response.body).toMatchObject({ title });
    },
  })),
  {
    name: 'POST /v1/auth/password-reset/confirmation answers a code it does not declare as 503 upstream.failed',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.confirmPasswordReset.mockRejectedValue(identityProblem(422, 'auth.code-invalid')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'POST /v1/auth/password-reset/confirmation answers 429 beyond the quota of the address',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD },
    arrange: ({ anonymousCounter }) =>
      anonymousCounter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/auth/password-reset/confirmation answers 503 when identity-service cannot answer',
    method: 'post',
    path: '/v1/auth/password-reset/confirmation',
    url: '/v1/auth/password-reset/confirmation',
    credential: 'none',
    body: { token: RESET_TOKEN, newPassword: NEW_PASSWORD },
    arrange: ({ identity }) =>
      identity.confirmPasswordReset.mockRejectedValue(identityUnavailable('deadline-exceeded')),
    status: 503,
    code: 'upstream.deadline-exceeded',
  },
];

describe('password reset and the cancellation of a deletion', () => {
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
    expectEveryDeclaredStatus(RECOVERY_CASES);
  });

  it.each(RECOVERY_CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it.each([
    ['/v1/auth/sign-in', { email: CAMILLE.email, password: PASSWORD }, 'signInWithPassword'],
    [
      '/v1/auth/sign-in/code/verification',
      { email: CAMILLE.email, code: '482913' },
      'signInWithCode',
    ],
  ] as const)(
    'passes deletionCancelled and passwordChangedAt on in the answer of %s',
    async (path, body, method) => {
      identity[method].mockResolvedValue(
        signedIn({
          token: 'new-session-token-0123456789',
          session: {
            id: CAMILLE_SESSION.sessionId,
            expiresAt: '2026-12-08T13:07:00Z',
            persistent: false,
          },
          user: { ...CAMILLE, passwordChangedAt: '2026-08-12T09:30:00Z' },
          deletionCancelled: true,
        }),
      );

      const response: request.Response = await runRouteCase(application, identity, {
        name: path,
        method: 'post',
        path,
        url: path,
        credential: 'none',
        body,
        status: 200,
      });

      expect(response.body).toMatchObject({
        user: { passwordChangedAt: '2026-08-12T09:30:00Z' },
        deletionCancelled: true,
      });
    },
  );

  it('leaves deletionCancelled out of a sign-in when identity-service does not send it', async () => {
    identity.signInWithPassword.mockResolvedValue(
      signedIn({
        token: 'new-session-token-0123456789',
        session: {
          id: CAMILLE_SESSION.sessionId,
          expiresAt: '2026-12-08T13:07:00Z',
          persistent: false,
        },
        user: { ...CAMILLE },
      }),
    );

    const response: request.Response = await runRouteCase(application, identity, {
      name: 'sign-in',
      method: 'post',
      path: '/v1/auth/sign-in',
      url: '/v1/auth/sign-in',
      credential: 'none',
      body: { email: CAMILLE.email, password: PASSWORD },
      status: 200,
    });

    expect(response.body).not.toHaveProperty('deletionCancelled');
    expect((response.body as { user: unknown }).user).not.toHaveProperty('passwordChangedAt');
  });
});

/**
 * Constant CHALLENGE
 *
 * @description
 * The two-step challenge identity-service answers a sign-in of an account with two-step
 * verification (`202`), as the internal contract shows it.
 *
 * @type {Record<string, unknown>}
 */
const CHALLENGE: {
  token: string;
  expiresAt: string;
  email: string;
  name: string;
  primaryMethod: string;
  methods: string[];
  securityKeys: { name: string }[];
  backupCodesRemaining: number;
  lockedUntil: string | null;
} = {
  token: 'ChallengeTokenOfTheSignInOfCamille00000000',
  expiresAt: '2026-11-09T07:52:00Z',
  email: CAMILLE.email,
  name: CAMILLE.name,
  primaryMethod: 'authenticator-app',
  methods: ['authenticator-app', 'security-key', 'backup-code'],
  securityKeys: [{ name: 'YubiKey 5C NFC' }],
  backupCodesRemaining: 7,
  lockedUntil: null,
};

/**
 * Constant DEVICE_TOKEN
 *
 * @description
 * Value of the trusted device cookie of the browser: a secret, sent on the two sign-ins only.
 *
 * @type {string}
 */
const DEVICE_TOKEN: string = 'TrustedDeviceTokenOfThisBrowser000000000000';

/**
 * Interface SignInRoute
 *
 * @description
 * One of the two sign-ins that may answer a two-step challenge, with a valid body and the method
 * of the fake it calls.
 */
interface SignInRoute {
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
   * A body the schema of the route accepts.
   *
   * @type {Record<string, unknown>}
   * @readonly
   */
  readonly body: Record<string, unknown>;

  /**
   * Property method
   *
   * @description
   * Method of the fake of identity-service the route calls.
   *
   * @type {'signInWithPassword' | 'signInWithCode'}
   * @readonly
   */
  readonly method: 'signInWithPassword' | 'signInWithCode';

  /**
   * Property refusal
   *
   * @description
   * The `422` of a wrong password or code.
   *
   * @type {string}
   * @readonly
   */
  readonly refusal: string;
  // #endregion
}

/**
 * Constant SIGN_INS
 *
 * @description
 * The sign-in by password and the sign-in by email code.
 *
 * @type {readonly SignInRoute[]}
 */
const SIGN_INS: readonly SignInRoute[] = [
  {
    path: '/v1/auth/sign-in',
    body: { email: CAMILLE.email, password: PASSWORD },
    method: 'signInWithPassword',
    refusal: 'auth.invalid-credentials',
  },
  {
    path: '/v1/auth/sign-in/code/verification',
    body: { email: CAMILLE.email, code: '482913' },
    method: 'signInWithCode',
    refusal: 'auth.code-invalid',
  },
];

/**
 * Function signInCases
 *
 * @description
 * The success, the challenge and every declared error of a sign-in.
 *
 * @param {SignInRoute} route - The sign-in.
 * @returns {RouteCase[]} The cases.
 */
function signInCases(route: SignInRoute): RouteCase[] {
  const base: Omit<RouteCase, 'name' | 'status'> = {
    method: 'post',
    path: route.path,
    url: route.path,
    credential: 'none',
    body: route.body,
    headers: BROWSER_HEADERS,
  };
  return [
    {
      ...base,
      name: `POST ${route.path} signs in with the session cookie on a 200`,
      arrange: ({ identity }) =>
        identity[route.method].mockResolvedValue(signedIn(issuedSession(false))),
      status: 200,
      check: (response) => {
        expect(response.headers['set-cookie']).toEqual([
          '__Host-cw_session=new-session-token-0123456789; Path=/; Secure; HttpOnly; SameSite=Lax',
        ]);
      },
    },
    {
      ...base,
      name: `POST ${route.path} answers the 202 challenge as is, with no cookie`,
      arrange: ({ identity }) =>
        identity[route.method].mockResolvedValue({ outcome: 'challenge', challenge: CHALLENGE }),
      status: 202,
      check: (response) => {
        expect(response.body).toEqual(CHALLENGE);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('no-store');
      },
    },
    {
      ...base,
      name: `POST ${route.path} sends the trusted device cookie as trustedDeviceToken, and no other cookie`,
      headers: {
        ...BROWSER_HEADERS,
        Cookie: `__Host-cw_session=stale-token; __Host-cw_trusted_device=${DEVICE_TOKEN}`,
      },
      arrange: ({ identity }) =>
        identity[route.method].mockResolvedValue(signedIn(issuedSession(false))),
      status: 200,
      check: (_response, { identity }) => {
        expect(identity[route.method]).toHaveBeenCalledWith({
          ...route.body,
          rememberMe: false,
          client: BROWSER_CLIENT,
          trustedDeviceToken: DEVICE_TOKEN,
        });
        expect(identity.introspect).not.toHaveBeenCalled();
      },
    },
    {
      ...base,
      name: `POST ${route.path} leaves out a device cookie longer than the internal contract allows`,
      headers: { ...BROWSER_HEADERS, Cookie: `__Host-cw_trusted_device=${'d'.repeat(257)}` },
      arrange: ({ identity }) =>
        identity[route.method].mockResolvedValue({ outcome: 'challenge', challenge: CHALLENGE }),
      status: 202,
      check: (_response, { identity }) => {
        expect(identity[route.method].mock.calls[0]?.[0]).not.toHaveProperty('trustedDeviceToken');
      },
    },
    {
      ...base,
      name: `POST ${route.path} refuses an invalid body before identity-service`,
      body: { email: 'camille' },
      status: 400,
      code: 'request.invalid',
    },
    {
      ...base,
      name: `POST ${route.path} refuses another origin`,
      origin: 'https://evil.test',
      status: 403,
      code: 'auth.csrf-rejected',
    },
    {
      ...base,
      name: `POST ${route.path} relays 422 ${route.refusal}`,
      arrange: ({ identity }) =>
        identity[route.method].mockRejectedValue(
          identityProblem(422, route.refusal, { remainingAttempts: 3 }),
        ),
      status: 422,
      code: route.refusal,
    },
    {
      ...base,
      name: `POST ${route.path} answers 429 beyond the quota of the address`,
      arrange: ({ anonymousCounter }) =>
        anonymousCounter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 }),
      status: 429,
      code: 'rate-limit.exceeded',
    },
    {
      ...base,
      name: `POST ${route.path} answers 503 when identity-service cannot answer`,
      arrange: ({ identity }) => identity[route.method].mockRejectedValue(identityUnavailable()),
      status: 503,
      code: 'upstream.unavailable',
    },
  ];
}

describe('the two-step challenge of the sign-ins', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;
  const cases: readonly RouteCase[] = SIGN_INS.flatMap(signInCases);

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

  it('exercises every status each sign-in declares', () => {
    expectEveryDeclaredStatus(cases);
  });

  it.each(cases.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('reads the trusted device cookie on the two sign-ins only, not on the sign-up verification', async () => {
    identity.verifySignUp.mockResolvedValue(issuedSession(false));

    await runRouteCase(application, identity, {
      name: 'sign-up verification',
      method: 'post',
      path: '/v1/auth/sign-up/verification',
      url: '/v1/auth/sign-up/verification',
      credential: 'none',
      body: { email: CAMILLE.email, code: '482913' },
      headers: { ...BROWSER_HEADERS, Cookie: `__Host-cw_trusted_device=${DEVICE_TOKEN}` },
      status: 200,
    });

    expect(identity.verifySignUp.mock.calls[0]?.[0]).not.toHaveProperty('trustedDeviceToken');
  });
});
