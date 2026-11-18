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

  /**
   * Property ifMatch
   *
   * @description
   * The `If-Match` header of the call, `null` without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly ifMatch: string | null;
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
  scopes: CAMILLE_SESSION.scopes,
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
        ifMatch: headers.get('If-Match'),
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

      expect(issued).toEqual({ outcome: 'signed-in', session: ISSUED });
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
      answer.mockReturnValue(
        json(200, { ...CAMILLE, passwordChangedAt: '2026-01-01T00:00:00Z', mfaEnabled: true }),
      );

      const read: unknown = await runWithOrganizationContext(user, () =>
        client.getUser(CAMILLE.id),
      );

      expect(read).toEqual({ ...CAMILLE, passwordChangedAt: '2026-01-01T00:00:00Z' });
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

  describe('introspectApiToken', () => {
    const active: Record<string, unknown> = {
      active: true,
      tokenType: 'api-token',
      apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e90',
      userId: CAMILLE.id,
      organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      role: 'owner',
      scopes: ['members:read'],
      expiresAt: null,
    };

    it('posts the token as the actor system and answers the active token', async () => {
      answer.mockReturnValue(json(200, active));

      await expect(client.introspectApiToken('cw_pat_secret')).resolves.toEqual({
        apiTokenId: active.apiTokenId,
        userId: CAMILLE.id,
        organizationId: active.organizationId,
        role: 'owner',
        scopes: ['members:read'],
        expiresAt: null,
      });
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: 'http://identity-service.test:3010/internal/v1/api-tokens/introspect',
        body: { token: 'cw_pat_secret' },
        principal: { actor: { type: 'system', id: null }, organizationId: null },
      });
    });

    it('answers null for an inactive token, and for an active one that is not a personal token', async () => {
      answer
        .mockReturnValueOnce(json(200, { active: false }))
        .mockReturnValueOnce(json(200, { ...active, tokenType: 'session' }));

      await expect(client.introspectApiToken('cw_pat_secret')).resolves.toBeNull();
      await expect(client.introspectApiToken('cw_pat_secret')).resolves.toBeNull();
    });

    it('is retried once after a 503, as an idempotent call', async () => {
      answer
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValue(json(200, active));

      await expect(client.introspectApiToken('cw_pat_secret')).resolves.not.toBeNull();
      expect(calls).toHaveLength(2);
    });
  });

  describe('the profile, the current organization and the tokens of a signed-in user', () => {
    const owner: OrganizationContext = {
      organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      actor: { type: 'user', id: CAMILLE.id },
      role: 'owner',
      scopes: ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'],
    };
    const token: Record<string, unknown> = {
      id: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e90',
      name: 'Synchronisation GitLab',
      prefix: 'cw_pat_Exam',
      scopes: ['tasks:read'],
      organizationId: owner.organizationId,
      createdAt: '2026-11-08T14:02:00Z',
      expiresAt: null,
      lastUsedAt: null,
    };

    it('changes the profile with If-Match, without retrying a 503', async () => {
      answer.mockReturnValue(new Response(null, { status: 503 }));

      await expect(
        runWithOrganizationContext(owner, () =>
          client.updateUser(CAMILLE.id, { jobTitle: null }, '"2"'),
        ),
      ).rejects.toBeInstanceOf(ProblemException);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        method: 'PATCH',
        url: `http://identity-service.test:3010/internal/v1/users/${CAMILLE.id}`,
        body: { jobTitle: null },
        principal: { actor: { type: 'user', id: CAMILLE.id } },
      });
    });

    it('answers the changed account', async () => {
      answer.mockReturnValue(json(200, { ...CAMILLE, jobTitle: 'Responsable produit' }));

      await expect(
        runWithOrganizationContext(owner, () =>
          client.updateUser(CAMILLE.id, { jobTitle: 'Responsable produit' }, undefined),
        ),
      ).resolves.toEqual({ ...CAMILLE, jobTitle: 'Responsable produit' });
    });

    it('chooses the current organization of a session', async () => {
      answer.mockReturnValue(json(200, { organizationId: owner.organizationId, role: 'owner' }));

      await expect(
        runWithOrganizationContext(owner, () =>
          client.switchSessionOrganization(CAMILLE_SESSION.sessionId, String(owner.organizationId)),
        ),
      ).resolves.toEqual({ organizationId: owner.organizationId, role: 'owner' });
      expect(calls[0]).toMatchObject({
        method: 'PUT',
        url: `http://identity-service.test:3010/internal/v1/sessions/${CAMILLE_SESSION.sessionId}/organization`,
        body: { organizationId: owner.organizationId },
      });
    });

    it('creates, lists and revokes tokens in the organization of the context', async () => {
      answer
        .mockReturnValueOnce(
          json(201, { apiToken: token, secret: 'cw_pat_ExampleOnlyNotARealToken000000000000' }),
        )
        .mockReturnValueOnce(json(200, { items: [token], nextCursor: null }))
        .mockReturnValueOnce(new Response(null, { status: 204 }));

      await runWithOrganizationContext(owner, () =>
        client.createApiToken({ name: 'Synchronisation GitLab', scopes: ['tasks:read'] }),
      );
      await runWithOrganizationContext(owner, () => client.listApiTokens({ limit: 50 }));
      await runWithOrganizationContext(owner, () => client.revokeApiToken(String(token.id)));

      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        'POST http://identity-service.test:3010/internal/v1/api-tokens',
        'GET http://identity-service.test:3010/internal/v1/api-tokens?limit=50',
        `DELETE http://identity-service.test:3010/internal/v1/api-tokens/${String(token.id)}`,
      ]);
      expect(calls.every((call) => call.principal.organizationId === owner.organizationId)).toBe(
        true,
      );
    });

    it('answers a created token whose secret does not have the format of the contract as 503', async () => {
      answer.mockReturnValue(json(201, { apiToken: token, secret: 'short' }));

      const failure: unknown = await runWithOrganizationContext(owner, () =>
        client.createApiToken({ name: 'Synchronisation GitLab', scopes: ['tasks:read'] }),
      ).catch((error: unknown) => error);

      expect((failure as ProblemException).problem).toMatchObject({ code: 'upstream.failed' });
      expect(JSON.stringify((failure as ProblemException).problem)).not.toContain('short');
    });

    it('creates a token with the session of the request in the body', async () => {
      answer.mockReturnValue(
        json(201, { apiToken: token, secret: 'cw_pat_ExampleOnlyNotARealToken000000000000' }),
      );

      await runWithOrganizationContext(owner, () =>
        client.createApiToken({
          sessionId: CAMILLE_SESSION.sessionId,
          name: 'Synchronisation GitLab',
          scopes: ['tasks:read'],
        }),
      );

      expect(calls[0]?.body).toEqual({
        sessionId: CAMILLE_SESSION.sessionId,
        name: 'Synchronisation GitLab',
        scopes: ['tasks:read'],
      });
    });
  });

  describe('the security of the account', () => {
    const user: OrganizationContext = {
      organizationId: null,
      actor: { type: 'user', id: CAMILLE.id },
      role: null,
      scopes: [],
    };
    const browser: { ipAddress: string; userAgent: string | null } = {
      ipAddress: '192.0.2.14',
      userAgent: 'Firefox',
    };
    const base = 'http://identity-service.test:3010/internal/v1';

    it('runs the password reset as the actor anonymous, secrets in the bodies only, never retried', async () => {
      answer
        .mockReturnValueOnce(
          json(202, {
            email: CAMILLE.email,
            expiresAt: '2026-11-09T13:40:00Z',
            resendAvailableAt: '2026-11-09T13:10:45Z',
          }),
        )
        .mockReturnValueOnce(
          json(200, { email: CAMILLE.email, expiresAt: '2026-11-09T13:40:00Z', sessionCount: 3 }),
        )
        .mockReturnValueOnce(new Response(null, { status: 503 }));

      await expect(
        client.requestPasswordReset({ email: CAMILLE.email, client: browser }),
      ).resolves.toMatchObject({ email: CAMILLE.email });
      await expect(client.inspectPasswordResetLink({ token: 'reset-token' })).resolves.toEqual({
        email: CAMILLE.email,
        expiresAt: '2026-11-09T13:40:00Z',
        sessionCount: 3,
      });
      await expect(
        client.confirmPasswordReset({
          token: 'reset-token',
          newPassword: 'nord-atelier-sprint-15',
          closeOtherSessions: false,
          client: browser,
        }),
      ).rejects.toMatchObject({ problem: { status: 503 } });

      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `POST ${base}/auth/password-reset`,
        `POST ${base}/auth/password-reset/inspection`,
        `POST ${base}/auth/password-reset/confirmation`,
      ]);
      expect(calls.map((call) => call.body)).toEqual([
        { email: CAMILLE.email, client: browser },
        { token: 'reset-token' },
        {
          token: 'reset-token',
          newPassword: 'nord-atelier-sprint-15',
          closeOtherSessions: false,
          client: browser,
        },
      ]);
      expect(calls.every((call) => call.principal.actor.type === 'anonymous')).toBe(true);
      expect(calls.some((call) => call.url.includes('reset-token'))).toBe(false);
    });

    it('confirms the password in the session of the path, as its user', async () => {
      answer.mockReturnValue(
        json(200, { authenticatedAt: '2026-11-09T13:12:00Z', expiresAt: '2026-11-09T13:22:00Z' }),
      );

      await expect(
        runWithOrganizationContext(user, () =>
          client.reauthenticate(CAMILLE_SESSION.sessionId, { password: 'atelier-nord-sprint-14' }),
        ),
      ).resolves.toEqual({
        authenticatedAt: '2026-11-09T13:12:00Z',
        expiresAt: '2026-11-09T13:22:00Z',
      });
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: `${base}/sessions/${CAMILLE_SESSION.sessionId}/reauthentication`,
        body: { password: 'atelier-nord-sprint-14' },
        principal: { actor: { type: 'user', id: CAMILLE.id } },
      });
    });

    it('changes the password with the session in the body, without retrying the PUT after a 503', async () => {
      answer.mockReturnValue(new Response(null, { status: 503 }));

      await expect(
        runWithOrganizationContext(user, () =>
          client.changePassword(CAMILLE.id, {
            sessionId: CAMILLE_SESSION.sessionId,
            currentPassword: 'atelier-nord-sprint-14',
            newPassword: 'nord-atelier-sprint-15',
            client: browser,
          }),
        ),
      ).rejects.toMatchObject({ problem: { status: 503 } });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        method: 'PUT',
        url: `${base}/users/${CAMILLE.id}/password`,
        body: { sessionId: CAMILLE_SESSION.sessionId, client: browser },
      });
    });

    it('answers the account after a change of password, with when it was set', async () => {
      answer.mockReturnValue(
        json(200, { ...CAMILLE, passwordChangedAt: '2026-11-09T13:16:00Z', version: 3 }),
      );

      await expect(
        runWithOrganizationContext(user, () =>
          client.changePassword(CAMILLE.id, {
            sessionId: CAMILLE_SESSION.sessionId,
            currentPassword: 'atelier-nord-sprint-14',
            newPassword: 'nord-atelier-sprint-15',
            client: browser,
          }),
        ),
      ).resolves.toEqual({ ...CAMILLE, passwordChangedAt: '2026-11-09T13:16:00Z', version: 3 });
    });

    it('changes the address and schedules the deletion with the session in the body', async () => {
      answer
        .mockReturnValueOnce(
          json(202, {
            email: 'camille@ateliernord.fr',
            expiresAt: '2026-11-09T13:35:00Z',
            resendAvailableAt: '2026-11-09T13:20:30Z',
          }),
        )
        .mockReturnValueOnce(json(200, { ...CAMILLE, email: 'camille@ateliernord.fr' }))
        .mockReturnValueOnce(json(202, { deleteAt: '2026-12-09T15:30:00Z' }));

      await runWithOrganizationContext(user, () =>
        client.requestEmailChange(CAMILLE.id, {
          sessionId: CAMILLE_SESSION.sessionId,
          email: 'camille@ateliernord.fr',
        }),
      );
      await runWithOrganizationContext(user, () =>
        client.confirmEmailChange(CAMILLE.id, {
          sessionId: CAMILLE_SESSION.sessionId,
          code: '731406',
          client: browser,
        }),
      );
      await expect(
        runWithOrganizationContext(user, () =>
          client.scheduleAccountDeletion(CAMILLE.id, { sessionId: CAMILLE_SESSION.sessionId }),
        ),
      ).resolves.toEqual({ deleteAt: '2026-12-09T15:30:00Z' });

      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `POST ${base}/users/${CAMILLE.id}/email-change`,
        `POST ${base}/users/${CAMILLE.id}/email-change/confirmation`,
        `POST ${base}/users/${CAMILLE.id}/deletion`,
      ]);
      expect(calls.map((call) => call.body)).toEqual([
        { sessionId: CAMILLE_SESSION.sessionId, email: 'camille@ateliernord.fr' },
        { sessionId: CAMILLE_SESSION.sessionId, code: '731406', client: browser },
        { sessionId: CAMILLE_SESSION.sessionId },
      ]);
    });

    it('answers a success status the deletion does not declare as 503 upstream.failed', async () => {
      answer.mockReturnValue(json(200, { deleteAt: '2026-12-09T15:30:00Z' }));

      await expect(
        runWithOrganizationContext(user, () =>
          client.scheduleAccountDeletion(CAMILLE.id, { sessionId: CAMILLE_SESSION.sessionId }),
        ),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    });

    it('lists the sessions with the session of the request as currentSessionId, retrying a 503 once', async () => {
      const page: Record<string, unknown> = {
        items: [
          {
            id: CAMILLE_SESSION.sessionId,
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
        ],
        nextCursor: null,
      };
      answer
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(json(200, page));

      await expect(
        runWithOrganizationContext(user, () =>
          client.listUserSessions(CAMILLE.id, {
            currentSessionId: CAMILLE_SESSION.sessionId,
            limit: 50,
          }),
        ),
      ).resolves.toEqual(page);
      expect(calls).toHaveLength(2);
      expect(calls[1]?.url).toBe(
        `${base}/users/${CAMILLE.id}/sessions?currentSessionId=${CAMILLE_SESSION.sessionId}&limit=50`,
      );
    });

    it('closes the other sessions of the session of the path', async () => {
      answer.mockReturnValue(json(200, { revokedCount: 2 }));

      await expect(
        runWithOrganizationContext(user, () =>
          client.revokeOtherSessions(CAMILLE_SESSION.sessionId),
        ),
      ).resolves.toEqual({ revokedCount: 2 });
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: `${base}/sessions/${CAMILLE_SESSION.sessionId}/revoke-others`,
        principal: { actor: { type: 'user', id: CAMILLE.id } },
      });
    });

    it('relays the refusal of a recent authentication with its code and details', async () => {
      answer.mockReturnValue(
        json(
          403,
          {
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
            code: 'auth.reauthentication-required',
            details: { methods: ['password'] },
          },
          'application/problem+json',
        ),
      );

      const failure: unknown = await runWithOrganizationContext(user, () =>
        client.scheduleAccountDeletion(CAMILLE.id, { sessionId: CAMILLE_SESSION.sessionId }),
      ).catch((error: unknown) => error);

      expect((failure as ProblemException).problem).toMatchObject({
        status: 403,
        code: 'auth.reauthentication-required',
        details: { methods: ['password'], service: IDENTITY_SERVICE },
      });
    });
  });

  describe('the two-step verification', () => {
    const user: OrganizationContext = {
      organizationId: null,
      actor: { type: 'user', id: CAMILLE.id },
      role: null,
      scopes: [],
    };
    const owner: OrganizationContext = {
      organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      actor: { type: 'user', id: CAMILLE.id },
      role: 'owner',
      scopes: ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'],
    };
    const browser: { ipAddress: string; userAgent: string | null } = {
      ipAddress: '192.0.2.14',
      userAgent: 'Firefox',
    };
    const base = 'http://identity-service.test:3010/internal/v1';
    const challenge: Record<string, unknown> = {
      token: 'ChallengeTokenOfCamilleSecret0000000000000',
      expiresAt: '2026-11-09T07:52:00Z',
      email: CAMILLE.email,
      name: CAMILLE.name,
      primaryMethod: 'authenticator-app',
      methods: ['authenticator-app', 'security-key', 'backup-code'],
      securityKeys: [{ name: 'YubiKey 5C NFC' }],
      backupCodesRemaining: 7,
      lockedUntil: null,
    };
    const state: Record<string, unknown> = {
      enabled: true,
      primaryMethod: 'authenticator-app',
      methods: ['authenticator-app'],
      authenticatorApp: { configuredAt: '2026-03-03T10:15:00Z' },
      securityKeys: [],
      backupCodes: { remaining: 7, total: 10, generatedAt: '2026-03-03T10:15:00Z' },
      requiredBy: [],
    };
    const policy: Record<string, unknown> = {
      twoStepVerificationRequiredFor: 'admins',
      sessionInactivityTimeoutMinutes: 720,
      membersWithoutTwoStepVerification: { admins: 0, everyone: 7 },
      version: 2,
    };

    it('answers the 202 of a sign-in as the challenge, validated as the inspection answers it, with the device token in the body', async () => {
      answer.mockReturnValue(json(202, { ...challenge, internalNote: 'not public' }));

      await expect(
        client.signInWithPassword({
          email: CAMILLE.email,
          password: 'atelier-nord-sprint-14',
          client: browser,
          trustedDeviceToken: 'trusted-device-token',
        }),
      ).resolves.toEqual({ outcome: 'challenge', challenge });
      expect(calls[0]).toMatchObject({
        url: `${base}/auth/sign-in`,
        body: { trustedDeviceToken: 'trusted-device-token' },
        principal: { actor: { type: 'anonymous', id: null } },
      });
      expect(calls[0]?.url).not.toContain('trusted-device-token');
    });

    it('answers a 202 challenge outside the contract as 503 upstream.failed, never quoting its token', async () => {
      answer.mockReturnValue(json(202, { ...challenge, token: 'short-secret' }));

      const failure: unknown = await client
        .signInWithCode({ email: CAMILLE.email, code: '482913', client: browser })
        .catch((error: unknown) => error);

      expect((failure as ProblemException).problem).toMatchObject({
        status: 503,
        code: 'upstream.failed',
      });
      expect(String((failure as ProblemException).cause)).toContain('token');
      expect(String((failure as ProblemException).cause)).not.toContain('short-secret');
    });

    it('answers a sign-in status the operation does not declare as 503 upstream.failed', async () => {
      answer.mockReturnValue(json(201, challenge));

      await expect(
        client.signInWithPassword({ email: CAMILLE.email, password: 'x', client: browser }),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    });

    it('passes the withheld organization of both introspections on', async () => {
      const withheld = { organizationId: owner.organizationId, code: 'organization.mfa-required' };
      answer
        .mockReturnValueOnce(json(200, { ...ACTIVE_SESSION, withheldOrganization: withheld }))
        .mockReturnValueOnce(
          json(200, {
            active: true,
            tokenType: 'api-token',
            apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e91',
            userId: CAMILLE.id,
            organizationId: owner.organizationId,
            role: 'member',
            scopes: [],
            expiresAt: null,
            withheldOrganization: withheld,
          }),
        );

      await expect(client.introspect('cookie-token')).resolves.toEqual({
        ...CAMILLE_SESSION,
        withheldOrganization: withheld,
      });
      await expect(client.introspectApiToken('cw_pat_token')).resolves.toMatchObject({
        scopes: [],
        withheldOrganization: withheld,
      });
    });

    it('runs the challenge as the actor anonymous, secrets in the bodies only, never retried', async () => {
      const session: Record<string, unknown> = {
        ...ISSUED,
        trustedDevice: {
          token: 'TrustedDeviceTokenOfCamille0000000000000000',
          expiresAt: '2026-12-09T07:42:00Z',
        },
      };
      const options: Record<string, unknown> = {
        options: { challenge: 'WebAuthnChallenge000000', hints: ['security-key'] },
        expiresAt: '2026-11-09T07:47:00Z',
      };
      const credential = {
        id: 'credential-id',
        rawId: 'credential-id',
        type: 'public-key',
        response: { clientDataJSON: 'c', authenticatorData: 'a', signature: 's' },
        futureMember: true,
      };
      answer
        .mockReturnValueOnce(json(200, challenge))
        .mockReturnValueOnce(json(200, session))
        .mockReturnValueOnce(json(200, session))
        .mockReturnValueOnce(json(200, options))
        .mockReturnValueOnce(json(200, session))
        .mockReturnValueOnce(new Response(null, { status: 503 }));
      const token = 'ChallengeTokenOfCamilleSecret0000000000000';

      await expect(client.inspectSignInChallenge({ token })).resolves.toEqual(challenge);
      await expect(
        client.answerSignInChallengeWithAuthenticatorApp({
          token,
          code: '261845',
          trustDevice: true,
          client: browser,
        }),
      ).resolves.toEqual(session);
      await expect(
        client.answerSignInChallengeWithBackupCode({
          token,
          code: '4F7K-2M9Q',
          trustDevice: false,
          client: browser,
        }),
      ).resolves.toEqual(session);
      await expect(client.getSignInChallengeSecurityKeyOptions({ token })).resolves.toEqual(
        options,
      );
      await expect(
        client.answerSignInChallengeWithSecurityKey({
          token,
          credential,
          trustDevice: true,
          client: browser,
        }),
      ).resolves.toEqual(session);
      await expect(
        client.answerSignInChallengeWithAuthenticatorApp({
          token,
          code: '261845',
          trustDevice: false,
          client: browser,
        }),
      ).rejects.toMatchObject({ problem: { status: 503 } });

      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `POST ${base}/auth/sign-in/challenge/inspection`,
        `POST ${base}/auth/sign-in/challenge/authenticator-app`,
        `POST ${base}/auth/sign-in/challenge/backup-code`,
        `POST ${base}/auth/sign-in/challenge/security-key/options`,
        `POST ${base}/auth/sign-in/challenge/security-key`,
        `POST ${base}/auth/sign-in/challenge/authenticator-app`,
      ]);
      expect(calls[4]?.body).toEqual({ token, credential, trustDevice: true, client: browser });
      expect(calls.every((call) => call.principal.actor.type === 'anonymous')).toBe(true);
      expect(calls.some((call) => call.url.includes(token))).toBe(false);
    });

    it('calls the two-step verification of the user of the context, retrying the read only', async () => {
      const change = { sessionId: CAMILLE_SESSION.sessionId, client: browser };
      // Five 503 in a row would open the circuit breaker: the last calls are refused instead.
      const refused = (): Response =>
        json(
          403,
          {
            status: 403,
            code: 'auth.reauthentication-required',
            details: { methods: ['password'] },
          },
          'application/problem+json',
        );
      answer
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(json(200, state))
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(refused())
        .mockReturnValueOnce(refused())
        .mockReturnValueOnce(refused())
        .mockReturnValueOnce(refused());
      const keyId = '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b01';
      const attempts: (() => Promise<unknown>)[] = [
        () => client.disableTwoStepVerification(CAMILLE.id, change),
        () =>
          client.startAuthenticatorAppSetup(CAMILLE.id, { sessionId: CAMILLE_SESSION.sessionId }),
        () =>
          client.confirmAuthenticatorAppSetup(CAMILLE.id, {
            sessionId: CAMILLE_SESSION.sessionId,
            code: '261845',
            client: browser,
          }),
        () => client.regenerateBackupCodes(CAMILLE.id, change),
        () =>
          client.startSecurityKeyRegistration(CAMILLE.id, {
            sessionId: CAMILLE_SESSION.sessionId,
          }),
        () =>
          client.addSecurityKey(CAMILLE.id, {
            sessionId: CAMILLE_SESSION.sessionId,
            name: 'YubiKey 5C NFC',
            credential: {
              id: 'credential-id',
              rawId: 'credential-id',
              type: 'public-key',
              response: { clientDataJSON: 'c', attestationObject: 'o' },
            },
            client: browser,
          }),
        () => client.removeSecurityKey(CAMILLE.id, keyId, change),
      ];

      await expect(
        runWithOrganizationContext(user, () => client.getTwoStepVerification(CAMILLE.id)),
      ).resolves.toEqual(state);
      for (const attempt of attempts) {
        await expect(runWithOrganizationContext(user, attempt)).rejects.toBeInstanceOf(
          ProblemException,
        );
      }

      const prefix = `${base}/users/${CAMILLE.id}/two-step-verification`;
      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `GET ${prefix}`,
        `GET ${prefix}`,
        `POST ${prefix}/disable`,
        `POST ${prefix}/authenticator-app/setup`,
        `POST ${prefix}/authenticator-app/setup/confirmation`,
        `POST ${prefix}/backup-codes/regenerate`,
        `POST ${prefix}/security-keys/registration`,
        `POST ${prefix}/security-keys`,
        `POST ${prefix}/security-keys/${keyId}/remove`,
      ]);
      expect(calls[2]?.body).toEqual(change);
      expect(calls[8]?.body).toEqual(change);
      expect(calls.every((call) => call.principal.actor.id === CAMILLE.id)).toBe(true);
      expect(calls.some((call) => call.url.includes('261845'))).toBe(false);
    });

    it('answers the secrets of a setup and the creation options of a key, keeping the WebAuthn members the contract does not list', async () => {
      const setup = {
        secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        otpauthUri: 'otpauth://totp/Cadenway:camille?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        expiresAt: '2026-11-09T13:35:00Z',
      };
      const registration = {
        options: {
          challenge: 'WebAuthnChallenge000000',
          rp: { id: 'cadenway.com', name: 'Cadenway' },
          user: { id: 'handle', name: CAMILLE.email, displayName: CAMILLE.name },
          pubKeyCredParams: [{ type: 'public-key', alg: -8 }],
          authenticatorSelection: { residentKey: 'preferred' },
          attestation: 'none',
        },
        expiresAt: '2026-11-09T13:26:00Z',
      };
      answer
        .mockReturnValueOnce(json(200, setup))
        .mockReturnValueOnce(json(200, registration))
        .mockReturnValueOnce(json(200, { ...setup, secret: 'not-base32' }));

      await expect(
        runWithOrganizationContext(user, () =>
          client.startAuthenticatorAppSetup(CAMILLE.id, { sessionId: CAMILLE_SESSION.sessionId }),
        ),
      ).resolves.toEqual(setup);
      await expect(
        runWithOrganizationContext(user, () =>
          client.startSecurityKeyRegistration(CAMILLE.id, {
            sessionId: CAMILLE_SESSION.sessionId,
          }),
        ),
      ).resolves.toEqual(registration);
      const failure: unknown = await runWithOrganizationContext(user, () =>
        client.startAuthenticatorAppSetup(CAMILLE.id, { sessionId: CAMILLE_SESSION.sessionId }),
      ).catch((error: unknown) => error);
      expect((failure as ProblemException).problem).toMatchObject({ code: 'upstream.failed' });
      expect(String((failure as ProblemException).cause)).not.toContain('not-base32');
    });

    it('reads the policy in the organization of the context, and changes it with the session in the query and If-Match, never retried', async () => {
      answer
        .mockReturnValueOnce(new Response(null, { status: 503 }))
        .mockReturnValueOnce(json(200, policy))
        .mockReturnValueOnce(new Response(null, { status: 503 }));

      await expect(
        runWithOrganizationContext(owner, () => client.getAuthenticationPolicy()),
      ).resolves.toEqual(policy);
      await expect(
        runWithOrganizationContext(owner, () =>
          client.updateAuthenticationPolicy(
            CAMILLE_SESSION.sessionId,
            { twoStepVerificationRequiredFor: 'everyone' },
            '"2"',
          ),
        ),
      ).rejects.toMatchObject({ problem: { status: 503 } });

      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `GET ${base}/organization/authentication-policy`,
        `GET ${base}/organization/authentication-policy`,
        `PATCH ${base}/organization/authentication-policy?sessionId=${CAMILLE_SESSION.sessionId}`,
      ]);
      expect(calls[2]).toMatchObject({
        body: { twoStepVerificationRequiredFor: 'everyone' },
        ifMatch: '"2"',
        principal: { organizationId: owner.organizationId, actor: { id: CAMILLE.id } },
      });
    });
  });
});
