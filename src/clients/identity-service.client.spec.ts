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
});
