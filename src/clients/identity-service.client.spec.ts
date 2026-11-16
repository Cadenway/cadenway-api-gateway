import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  ProblemException,
  runWithOrganizationContext,
  type Ed25519PrivateJwk,
  type InternalPrincipal,
  type OrganizationContext,
} from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { CAMILLE, CAMILLE_SESSION } from '../../tests/support/fake-identity.js';
import {
  GATEWAY_ISSUER,
  generateSigningKeys,
  type SigningKeys,
} from '../../tests/support/test-environment.js';
import { IDENTITY_SERVICE, IdentityServiceClient } from './identity-service.client.js';

/**
 * Interface RecordedCall
 *
 * @description
 * A call the fake identity-service received.
 */
interface RecordedCall {
  // #region Properties
  /**
   * Property method
   *
   * @description
   * HTTP method.
   *
   * @type {string}
   * @readonly
   */
  readonly method: string;

  /**
   * Property url
   *
   * @description
   * Absolute URL called.
   *
   * @type {string}
   * @readonly
   */
  readonly url: string;

  /**
   * Property body
   *
   * @description
   * Parsed JSON body, `undefined` without one.
   *
   * @type {unknown}
   * @readonly
   */
  readonly body: unknown;

  /**
   * Property principal
   *
   * @description
   * The internal token, verified as identity-service verifies it.
   *
   * @type {InternalPrincipal}
   * @readonly
   */
  readonly principal: InternalPrincipal;
  // #endregion
}

/**
 * Constant ACTIVE_SESSION
 *
 * @description
 * Answer of the introspection for an active session.
 *
 * @type {Record<string, unknown>}
 */
const ACTIVE_SESSION: Record<string, unknown> = {
  active: true,
  tokenType: 'session',
  sessionId: CAMILLE_SESSION.sessionId,
  userId: CAMILLE.id,
  organizationId: null,
  role: null,
  scopes: [],
  expiresAt: CAMILLE_SESSION.expiresAt,
};

/**
 * Constant ISSUED
 *
 * @description
 * Answer of a route that signs in.
 *
 * @type {Record<string, unknown>}
 */
const ISSUED: Record<string, unknown> = {
  token: 'opaque-token',
  session: { id: CAMILLE_SESSION.sessionId, expiresAt: '2026-12-08T13:07:00Z', persistent: true },
  user: CAMILLE,
};

/**
 * Function json
 *
 * @description
 * A JSON response of the fake identity-service.
 *
 * @param {number} status - HTTP status.
 * @param {unknown} body - JSON body.
 * @param {string} contentType - Media type.
 * @returns {Response} The response.
 */
function json(status: number, body: unknown, contentType: string = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

describe('IdentityServiceClient', () => {
  let signer: InternalTokenSigner;
  let verifier: InternalTokenVerifier;
  let calls: RecordedCall[];
  let answer: Mock<() => Response>;
  let client: IdentityServiceClient;

  beforeAll(async () => {
    const keys: SigningKeys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: IDENTITY_SERVICE,
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
  });

  beforeEach(() => {
    calls = [];
    answer = vi.fn(() => new Response(null, { status: 204 }));
    const fetchImplementation: typeof fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const headers: Headers = new Headers(init?.headers);
      const authorization: string = headers.get('Authorization') ?? '';
      calls.push({
        method: init?.method ?? 'GET',
        url: input instanceof Request ? input.url : input.toString(),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        principal: await verifier.verify(authorization.replace(/^Bearer /u, '')),
      });
      return answer();
    };
    client = new IdentityServiceClient(
      new InternalHttpClient({
        service: IDENTITY_SERVICE,
        baseUrl: 'http://identity-service.test:3010',
        signer,
        fetch: fetchImplementation,
      }),
    );
  });

  describe('introspect', () => {
    it('posts the token as the actor system and answers the active session', async () => {
      answer.mockReturnValue(json(200, ACTIVE_SESSION));

      await expect(client.introspect('cookie-token')).resolves.toEqual(CAMILLE_SESSION);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: 'http://identity-service.test:3010/internal/v1/tokens/introspect',
        body: { token: 'cookie-token' },
        principal: {
          issuer: GATEWAY_ISSUER,
          audience: IDENTITY_SERVICE,
          actor: { type: 'system', id: null },
          organizationId: null,
        },
      });
    });

    it('answers null for an inactive token', async () => {
      answer.mockReturnValue(json(200, { active: false }));

      await expect(client.introspect('cookie-token')).resolves.toBeNull();
    });

    it('answers null for an active token that is not a session token', async () => {
      answer.mockReturnValue(json(200, { ...ACTIVE_SESSION, tokenType: 'api-token' }));

      await expect(client.introspect('cookie-token')).resolves.toBeNull();
    });

    it('is retried once after a 503, as an idempotent call', async () => {
      answer
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(json(200, ACTIVE_SESSION));

      await expect(client.introspect('cookie-token')).resolves.toEqual(CAMILLE_SESSION);
      expect(calls).toHaveLength(2);
    });

    it('answers an answer outside the contract as 503 upstream.failed, naming members only', async () => {
      answer.mockReturnValue(json(200, { ...ACTIVE_SESSION, sessionId: 'cookie-token' }));

      const failure: unknown = await client
        .introspect('cookie-token')
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ProblemException);
      expect((failure as ProblemException).problem).toMatchObject({
        status: 503,
        code: 'upstream.failed',
        details: { service: IDENTITY_SERVICE },
      });
      expect(String((failure as ProblemException).cause)).toContain('sessionId');
      expect(String((failure as ProblemException).cause)).not.toContain('cookie-token');
    });

    it('answers a body that is not JSON as 503 upstream.failed, without quoting it', async () => {
      answer.mockReturnValue(
        new Response('{"token":"secret-session-token"', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const failure: unknown = await client
        .introspect('cookie-token')
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ProblemException);
      expect((failure as ProblemException).problem).toMatchObject({
        status: 503,
        code: 'upstream.failed',
      });
      expect(String((failure as ProblemException).cause)).not.toContain('secret-session-token');
    });

    it('answers a refused internal token (401) as 503 upstream.unauthorized', async () => {
      answer.mockReturnValue(
        json(401, { code: 'auth.token-invalid', status: 401 }, 'application/problem+json'),
      );

      await expect(client.introspect('cookie-token')).rejects.toMatchObject({
        problem: { status: 503, code: 'upstream.unauthorized' },
      });
    });
  });

  describe('the flows before a session', () => {
    it('signs in as the actor anonymous, sending the browser, without retrying a 503', async () => {
      answer.mockReturnValue(new Response(null, { status: 503 }));

      await expect(
        client.signInWithPassword({
          email: CAMILLE.email,
          password: 'atelier-nord-sprint-14',
          rememberMe: true,
          client: { ipAddress: '86.247.12.30', userAgent: null },
        }),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.unavailable' } });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: 'http://identity-service.test:3010/internal/v1/auth/sign-in',
        body: { client: { ipAddress: '86.247.12.30', userAgent: null } },
        principal: { actor: { type: 'anonymous', id: null }, organizationId: null, scopes: [] },
      });
    });

    it('answers the issued session, keeping the members of the contract only', async () => {
      answer.mockReturnValue(json(200, { ...ISSUED, internalNote: 'not public' }));

      const issued: unknown = await client.signInWithCode({
        email: CAMILLE.email,
        code: '482913',
        rememberMe: true,
        client: { ipAddress: '86.247.12.30', userAgent: null },
      });

      expect(issued).toEqual(ISSUED);
      expect(calls[0]?.url).toBe(
        'http://identity-service.test:3010/internal/v1/auth/sign-in/code/verification',
      );
    });

    it.each([
      ['discoverSignInMethods', 'sign-in-methods', 200, { methods: [{ type: 'password' }] }],
      [
        'signUp',
        'sign-up',
        202,
        {
          email: CAMILLE.email,
          expiresAt: '2026-11-08T13:17:00Z',
          resendAvailableAt: '2026-11-08T13:07:30Z',
        },
      ],
      [
        'resendSignUpCode',
        'sign-up/code',
        202,
        {
          email: CAMILLE.email,
          expiresAt: '2026-11-08T13:17:00Z',
          resendAvailableAt: '2026-11-08T13:07:30Z',
        },
      ],
      [
        'requestSignInCode',
        'sign-in/code',
        202,
        {
          email: CAMILLE.email,
          expiresAt: '2026-11-08T13:17:00Z',
          resendAvailableAt: '2026-11-08T13:07:30Z',
        },
      ],
    ] as const)(
      '%s posts to /internal/v1/auth/%s as anonymous',
      async (method, path, status, body) => {
        answer.mockReturnValue(json(status, body));
        const request: {
          name: string;
          email: string;
          password: string;
          acceptTerms: boolean;
        } = {
          name: CAMILLE.name,
          email: CAMILLE.email,
          password: 'atelier-nord-sprint-14',
          acceptTerms: true,
        };

        await expect(client[method](request)).resolves.toEqual(body);
        expect(calls[0]).toMatchObject({
          method: 'POST',
          url: `http://identity-service.test:3010/internal/v1/auth/${path}`,
          principal: { actor: { type: 'anonymous', id: null } },
        });
      },
    );

    it('verifies the sign-up code with the password of the sign-up in the body', async () => {
      answer.mockReturnValue(json(200, ISSUED));
      const request: {
        email: string;
        code: string;
        password: string;
        client: { ipAddress: string; userAgent: null };
      } = {
        email: CAMILLE.email,
        code: '482913',
        password: 'atelier-nord-sprint-14',
        client: { ipAddress: '86.247.12.30', userAgent: null },
      };

      await expect(client.verifySignUp(request)).resolves.toEqual(ISSUED);
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: 'http://identity-service.test:3010/internal/v1/auth/sign-up/verification',
        principal: { actor: { type: 'anonymous', id: null } },
      });
      expect(calls[0]?.body).toEqual(request);
    });

    it('verifies the sign-up code without a password member when none is given', async () => {
      answer.mockReturnValue(json(200, ISSUED));

      await client.verifySignUp({
        email: CAMILLE.email,
        code: '482913',
        client: { ipAddress: '86.247.12.30', userAgent: null },
      });

      expect(calls[0]?.body).not.toHaveProperty('password');
    });

    it('relays a client error with its code and details, naming identity-service', async () => {
      answer.mockReturnValue(
        json(
          422,
          {
            type: 'about:blank',
            title: 'Unprocessable Content',
            status: 422,
            code: 'auth.password-too-short',
            details: { minLength: 12 },
          },
          'application/problem+json',
        ),
      );

      await expect(
        client.signUp({
          name: CAMILLE.name,
          email: CAMILLE.email,
          password: 'short',
          acceptTerms: true,
        }),
      ).rejects.toMatchObject({
        problem: {
          status: 422,
          code: 'auth.password-too-short',
          details: { minLength: 12, service: IDENTITY_SERVICE },
        },
      });
    });

    it('answers a success status the operation does not declare as 503 upstream.failed', async () => {
      answer.mockReturnValue(json(200, { email: CAMILLE.email }));

      await expect(client.resendSignUpCode({ email: CAMILLE.email })).rejects.toMatchObject({
        problem: { status: 503, code: 'upstream.failed' },
      });
    });
  });

  describe('the calls of a signed-in user', () => {
    const user: OrganizationContext = {
      organizationId: null,
      actor: { type: 'user', id: CAMILLE.id },
      role: null,
      scopes: [],
    };

    it('revokes a session as the user of the context', async () => {
      await runWithOrganizationContext(user, () => client.revokeSession(CAMILLE_SESSION.sessionId));

      expect(calls[0]).toMatchObject({
        method: 'DELETE',
        url: `http://identity-service.test:3010/internal/v1/sessions/${CAMILLE_SESSION.sessionId}`,
        principal: { actor: { type: 'user', id: CAMILLE.id }, organizationId: null },
      });
    });

    it('reads the account as the user of the context, keeping the members of the contract only', async () => {
      answer.mockReturnValue(json(200, { ...CAMILLE, passwordChangedAt: '2026-01-01T00:00:00Z' }));

      const read: unknown = await runWithOrganizationContext(user, () =>
        client.getUser(CAMILLE.id),
      );

      expect(read).toEqual(CAMILLE);
      expect(calls[0]).toMatchObject({
        method: 'GET',
        url: `http://identity-service.test:3010/internal/v1/users/${CAMILLE.id}`,
        principal: { actor: { type: 'user', id: CAMILLE.id } },
      });
    });

    it('refuses to read an account outside an organization context', async () => {
      await expect(client.getUser(CAMILLE.id)).rejects.toThrow(/outside an organization context/u);
      expect(calls).toHaveLength(0);
    });
  });
});
