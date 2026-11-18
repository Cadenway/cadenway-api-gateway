import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
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
 * Constant TOKEN
 *
 * @description
 * A token of Camille in Atelier Nord, as identity-service answers it.
 *
 * @type {{ id: string; name: string; prefix: string; scopes: string[]; organizationId: string; createdAt: string; expiresAt: string | null; lastUsedAt: string | null }}
 */
const TOKEN: {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  organizationId: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
} = {
  id: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e92',
  name: 'Synchronisation GitLab',
  prefix: 'cw_pat_Abcd',
  scopes: ['tasks:read'],
  organizationId: ATELIER_NORD_ID,
  createdAt: '2026-11-08T14:02:00Z',
  expiresAt: '2026-12-08T14:02:00Z',
  lastUsedAt: null,
};

/**
 * Constant SECRET
 *
 * @description
 * The secret identity-service returns once for a created token.
 *
 * @type {string}
 */
const SECRET: string = 'cw_pat_AbcdNewlyCreatedSecretOfTheTest00000';

/**
 * Constant CREATION
 *
 * @description
 * A creation form, as the account screen sends it.
 *
 * @type {Record<string, unknown>}
 */
const CREATION: Record<string, unknown> = {
  name: 'Synchronisation GitLab',
  scopes: ['tasks:read'],
};

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each personal API token route.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/api-tokens answers the token and its secret once, with Location',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: CREATION,
    arrange: ({ identity }) =>
      identity.createApiToken.mockResolvedValue({ apiToken: { ...TOKEN }, secret: SECRET }),
    status: 201,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ apiToken: TOKEN, secret: SECRET });
      expect(response.headers.location).toBe(`/v1/api-tokens/${TOKEN.id}`);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.createApiToken).toHaveBeenCalledWith({
        sessionId: CAMILLE_ORGANIZATION_SESSION.sessionId,
        name: 'Synchronisation GitLab',
        scopes: ['tasks:read'],
        expiration: '30-days',
      });
    },
  },
  {
    name: 'POST /v1/api-tokens refuses a scope the contract does not know',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: { name: 'Admin', scopes: ['admin'] },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/api-tokens answers 401 without a credential',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    credential: 'none',
    body: CREATION,
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/api-tokens refuses a personal API token',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    credential: 'members-token',
    origin: null,
    body: CREATION,
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'POST /v1/api-tokens relays 403 auth.reauthentication-required with its methods, creating nothing',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: CREATION,
    arrange: ({ identity }) =>
      identity.createApiToken.mockRejectedValue(
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
      expect(response.headers.location).toBeUndefined();
    },
  },
  {
    name: 'POST /v1/api-tokens answers 404 session.not-found as 401 auth.session-expired',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: CREATION,
    arrange: ({ identity }) =>
      identity.createApiToken.mockRejectedValue(identityProblem(404, 'session.not-found')),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'POST /v1/api-tokens answers 429 beyond the quota',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: CREATION,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 6 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/api-tokens answers a missing organization of the internal token as 503',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: CREATION,
    arrange: ({ identity }) =>
      identity.createApiToken.mockRejectedValue(identityProblem(403, 'auth.organization-required')),
    status: 503,
    code: 'upstream.unauthorized',
  },
  {
    name: 'GET /v1/api-tokens answers the active tokens, never with a secret',
    method: 'get',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens?limit=25',
    arrange: ({ identity }) =>
      identity.listApiTokens.mockResolvedValue({ items: [{ ...TOKEN }], nextCursor: null }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ items: [TOKEN], nextCursor: null });
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(identity.listApiTokens).toHaveBeenCalledWith({ limit: 25 });
    },
  },
  {
    name: 'GET /v1/api-tokens refuses an unknown query parameter',
    method: 'get',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens?organizationId=other',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'GET /v1/api-tokens answers 401 for an ended session',
    method: 'get',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    credential: { cookie: 'ended' },
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'GET /v1/api-tokens answers 403 organization.not-selected without a current organization',
    method: 'get',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    credential: 'session-without-organization',
    status: 403,
    code: 'organization.not-selected',
  },
  {
    name: 'GET /v1/api-tokens answers 429 beyond the quota',
    method: 'get',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 6 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/api-tokens answers 503 when identity-service cannot answer',
    method: 'get',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    arrange: ({ identity }) => identity.listApiTokens.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} revokes the token on its Origin alone',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: `/v1/api-tokens/${TOKEN.id}`,
    arrange: ({ identity }) => identity.revokeApiToken.mockResolvedValue(undefined),
    status: 204,
    check: (_response, { identity }) => {
      expect(identity.revokeApiToken).toHaveBeenCalledWith(TOKEN.id);
    },
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} refuses an id that is not a UUID',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: '/v1/api-tokens/gitlab',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} answers 401 without a credential',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: `/v1/api-tokens/${TOKEN.id}`,
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} refuses a cookie request without Origin',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: `/v1/api-tokens/${TOKEN.id}`,
    origin: null,
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} relays 404 api-token.not-found',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: `/v1/api-tokens/${TOKEN.id}`,
    arrange: ({ identity }) =>
      identity.revokeApiToken.mockRejectedValue(identityProblem(404, 'api-token.not-found')),
    status: 404,
    code: 'api-token.not-found',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Jeton introuvable.' });
    },
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} answers 429 beyond the quota',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: `/v1/api-tokens/${TOKEN.id}`,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 6 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'DELETE /v1/api-tokens/{apiTokenId} answers 503 when identity-service cannot answer',
    method: 'delete',
    path: '/v1/api-tokens/{apiTokenId}',
    url: `/v1/api-tokens/${TOKEN.id}`,
    arrange: ({ identity }) =>
      identity.revokeApiToken.mockRejectedValue(identityUnavailable('deadline-exceeded')),
    status: 503,
    code: 'upstream.deadline-exceeded',
  },
];

describe('routes of api-tokens.yaml', () => {
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

  it('exercises every status each token route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('creates the token in the current organization of the session, never writing its secret into the logs', async () => {
    let context: OrganizationContext | undefined;
    identity.createApiToken.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve({ apiToken: { ...TOKEN }, secret: SECRET });
    });
    application.logLines.length = 0;

    await runRouteCase(application, identity, {
      name: 'creation',
      method: 'post',
      path: '/v1/api-tokens',
      url: '/v1/api-tokens',
      body: CREATION,
      status: 201,
    });

    expect(context).toMatchObject({
      organizationId: ATELIER_NORD_ID,
      actor: { type: 'user', id: CAMILLE.id },
    });
    expect(application.logLines.join('\n')).not.toContain(SECRET);
  });
});
