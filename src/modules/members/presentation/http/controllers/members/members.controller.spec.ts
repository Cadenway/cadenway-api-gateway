import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ALL_SCOPES,
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  MEMBERS_API_TOKEN,
  MEMBERS_TOKEN,
  TASKS_TOKEN,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { CAMILLE_MEMBER, INES } from '../../../../../../../tests/support/fake-organization.js';
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

/**
 * Constant MEMBER_URL
 *
 * @description
 * URL of Inès Robert, member of Atelier Nord.
 *
 * @type {string}
 */
const MEMBER_URL: string = `/v1/members/${INES.id}`;

/**
 * Function organizationProblem
 *
 * @description
 * What the internal HTTP client throws for a client error of organization-service.
 *
 * @param {400 | 403 | 404 | 409 | 412 | 422} status - Status organization-service answered.
 * @param {string} code - Code of its problem.
 * @param {Readonly<Record<string, unknown>>} details - Details of its problem.
 * @returns {ReturnType<typeof identityProblem>} The problem.
 */
function organizationProblem(
  status: 400 | 403 | 404 | 409 | 412 | 422,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): ReturnType<typeof identityProblem> {
  return identityProblem(status, code, details, 'organization-service');
}

/**
 * Constant PAGE
 *
 * @description
 * A page of members as organization-service answers it.
 *
 * @type {{ items: (typeof INES)[]; nextCursor: null; total: number; counts: { owner: number; admin: number; member: number; guest: number } }}
 */
const PAGE: {
  items: (typeof INES)[];
  nextCursor: null;
  total: number;
  counts: { owner: number; admin: number; member: number; guest: number };
} = {
  items: [CAMILLE_MEMBER, INES],
  nextCursor: null,
  total: 2,
  counts: { owner: 1, admin: 2, member: 15, guest: 4 },
};

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each member route.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  {
    name: 'GET /v1/members answers a page of members to a session',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members?limit=20&search=ines&role=owner,admin',
    arrange: ({ organization }) => organization.listMembers.mockResolvedValue({ ...PAGE }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toEqual(PAGE);
      expect(organization.listMembers).toHaveBeenCalledWith({
        limit: 20,
        search: 'ines',
        role: ['owner', 'admin'],
      });
    },
  },
  {
    name: 'GET /v1/members refuses an invalid query before any call',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members?limit=0&role=boss&page=2',
    status: 400,
    code: 'request.invalid',
    check: (response, { organization }) => {
      expect(organization.listMembers).not.toHaveBeenCalled();
      const issues = (response.body as { details: { issues: { path: string }[] } }).details.issues;
      expect(issues.map((issue) => issue.path).sort()).toEqual(['limit', 'page', 'role.0']);
    },
  },
  {
    name: 'GET /v1/members answers 401 without a credential',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members',
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'GET /v1/members answers 403 auth.scope-missing to a tasks:read token',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members',
    credential: 'tasks-token',
    status: 403,
    code: 'auth.scope-missing',
    check: (response, { organization }) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Ce jeton n’a pas la portée nécessaire pour cette requête.',
        status: 403,
        code: 'auth.scope-missing',
        detail: 'The personal API token lacks a scope this route requires.',
        details: { requiredScopes: ['members:read'] },
      });
      expect(organization.listMembers).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET /v1/members answers 404 when the caller left the organization',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members',
    arrange: ({ organization }) =>
      organization.listMembers.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'GET /v1/members answers 429 beyond the quota of the session',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 }),
    status: 429,
    code: 'rate-limit.exceeded',
    check: (response, { organization }) => {
      expect(response.headers['retry-after']).toBe('17');
      expect(response.headers.ratelimit).toBeUndefined();
      expect(response.body).toMatchObject({
        title: 'Trop de requêtes : réessayez dans un instant.',
      });
      expect(organization.listMembers).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET /v1/members answers 503 when organization-service cannot answer',
    method: 'get',
    path: '/v1/members',
    url: '/v1/members',
    arrange: ({ organization }) =>
      organization.listMembers.mockRejectedValue(
        identityUnavailable('timeout', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.timeout',
  },
  {
    name: 'GET /v1/members/{memberId} answers the member with its ETag to a members:read token',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: 'members-token',
    arrange: ({ organization }) => organization.getMember.mockResolvedValue({ ...INES }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toEqual(INES);
      expect(response.headers.etag).toBe('"2"');
      expect(organization.getMember).toHaveBeenCalledWith(INES.id);
    },
  },
  {
    name: 'GET /v1/members/{memberId} refuses an id that is not a UUID',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: '/v1/members/ines',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'GET /v1/members/{memberId} answers 401 for an unknown token',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: { bearer: 'Bearer cw_pat_RevokedTokenOfSomebody00000000000000' },
    status: 401,
    code: 'auth.api-token-invalid',
    check: (response, { identity, organization }) => {
      expect(response.body).toMatchObject({ title: 'Jeton d’API invalide, expiré ou révoqué.' });
      expect(identity.introspectApiToken).toHaveBeenCalledTimes(1);
      expect(organization.getMember).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET /v1/members/{memberId} relays 403 organization.role-forbidden for a guest',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    arrange: ({ organization }) =>
      organization.getMember.mockRejectedValue(
        organizationProblem(403, 'organization.role-forbidden'),
      ),
    status: 403,
    code: 'organization.role-forbidden',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Votre rôle ne permet pas cette action.' });
    },
  },
  {
    name: 'GET /v1/members/{memberId} answers 404 member.not-found for a member of another organization',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    arrange: ({ organization }) =>
      organization.getMember.mockRejectedValue(organizationProblem(404, 'member.not-found')),
    status: 404,
    code: 'member.not-found',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Membre introuvable.' });
    },
  },
  {
    name: 'GET /v1/members/{memberId} answers 429 beyond the quota of the token',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: 'members-token',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 3 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/members/{memberId} answers 503 when the introspection cannot be made',
    method: 'get',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: 'members-token',
    arrange: ({ identity }) =>
      identity.introspectApiToken.mockRejectedValue(identityUnavailable('unreachable')),
    status: 503,
    code: 'upstream.unreachable',
  },
  {
    name: 'PATCH /v1/members/{memberId} gives the role, relaying If-Match',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'member' },
    headers: { 'If-Match': '"2"' },
    arrange: ({ organization }) =>
      organization.changeMemberRole.mockResolvedValue({ ...INES, role: 'member', version: 3 }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toMatchObject({ role: 'member', version: 3 });
      expect(response.headers.etag).toBe('"3"');
      expect(organization.changeMemberRole).toHaveBeenCalledWith(
        INES.id,
        { role: 'member' },
        '"2"',
      );
    },
  },
  {
    name: 'PATCH /v1/members/{memberId} refuses a blank If-Match before any call',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'member' },
    headers: { 'If-Match': '' },
    status: 400,
    code: 'request.invalid',
    check: (response, { organization }) => {
      expect(response.body).toMatchObject({
        details: { issues: [{ in: 'header', path: 'If-Match' }] },
      });
      expect(organization.changeMemberRole).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH /v1/members/{memberId} refuses role owner before any call',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'owner' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'PATCH /v1/members/{memberId} answers 401 for an ended session',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: { cookie: 'ended-session-token' },
    body: { role: 'admin' },
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'PATCH /v1/members/{memberId} refuses a personal API token',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: 'members-token',
    body: { role: 'admin' },
    origin: null,
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'PATCH /v1/members/{memberId} answers 404 member.not-found when the caller left the organization',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'admin' },
    arrange: ({ organization }) =>
      organization.changeMemberRole.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'member.not-found',
  },
  {
    name: 'PATCH /v1/members/{memberId} relays 412 request.version-mismatch with the version',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'admin' },
    headers: { 'If-Match': '"1"' },
    arrange: ({ organization }) =>
      organization.changeMemberRole.mockRejectedValue(
        organizationProblem(412, 'request.version-mismatch', { version: 2 }),
      ),
    status: 412,
    code: 'request.version-mismatch',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Ces informations ont été modifiées entre-temps : rechargez la page.',
        details: { version: 2 },
      });
    },
  },
  {
    name: 'PATCH /v1/members/{memberId} relays 422 member.owner-protected',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: `/v1/members/${CAMILLE_MEMBER.id}`,
    body: { role: 'admin' },
    arrange: ({ organization }) =>
      organization.changeMemberRole.mockRejectedValue(
        organizationProblem(422, 'member.owner-protected'),
      ),
    status: 422,
    code: 'member.owner-protected',
  },
  {
    name: 'PATCH /v1/members/{memberId} answers 429 beyond the quota',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'admin' },
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'PATCH /v1/members/{memberId} answers a refused internal token as 503',
    method: 'patch',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    body: { role: 'admin' },
    arrange: ({ organization }) =>
      organization.changeMemberRole.mockRejectedValue(
        organizationProblem(403, 'auth.organization-required'),
      ),
    status: 503,
    code: 'upstream.unauthorized',
  },
  {
    name: 'DELETE /v1/members/{memberId} removes the member on its Origin alone, without a body',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    arrange: ({ organization }) => organization.removeMember.mockResolvedValue(undefined),
    status: 204,
    check: (_response, { organization }) => {
      expect(organization.removeMember).toHaveBeenCalledWith(INES.id);
    },
  },
  {
    name: 'DELETE /v1/members/{memberId} refuses an id that is not a UUID',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: '/v1/members/1',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'DELETE /v1/members/{memberId} answers 401 without a credential',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'DELETE /v1/members/{memberId} refuses a cookie request without Origin',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    origin: null,
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'DELETE /v1/members/{memberId} answers 404 member.not-found',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    arrange: ({ organization }) =>
      organization.removeMember.mockRejectedValue(organizationProblem(404, 'member.not-found')),
    status: 404,
    code: 'member.not-found',
  },
  {
    name: 'DELETE /v1/members/{memberId} relays 422 member.owner-protected',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: `/v1/members/${CAMILLE_MEMBER.id}`,
    arrange: ({ organization }) =>
      organization.removeMember.mockRejectedValue(
        organizationProblem(422, 'member.owner-protected'),
      ),
    status: 422,
    code: 'member.owner-protected',
  },
  {
    name: 'DELETE /v1/members/{memberId} answers 429 beyond the quota',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'DELETE /v1/members/{memberId} answers 503 when organization-service cannot answer',
    method: 'delete',
    path: '/v1/members/{memberId}',
    url: MEMBER_URL,
    arrange: ({ organization }) =>
      organization.removeMember.mockRejectedValue(
        identityUnavailable('circuit-open', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.circuit-open',
  },
];

describe('routes of /v1/members', () => {
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

  it('exercises every status each member route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  describe('the column "Deux étapes" of the members', () => {
    it('passes twoStepVerificationEnabled on, member by member, when organization-service sends it', async () => {
      const page: typeof PAGE = {
        ...PAGE,
        items: [
          { ...CAMILLE_MEMBER, twoStepVerificationEnabled: true },
          { ...INES, twoStepVerificationEnabled: false },
        ],
      };
      application.organization.listMembers.mockResolvedValue(page);

      const response = await runRouteCase(application, identity, {
        name: 'column',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        status: 200,
      });

      expect(response.body).toEqual(page);
    });

    it('passes twoStepVerificationEnabled on for one member too', async () => {
      application.organization.getMember.mockResolvedValue({
        ...INES,
        twoStepVerificationEnabled: false,
      });

      const response = await runRouteCase(application, identity, {
        name: 'member',
        method: 'get',
        path: '/v1/members/{memberId}',
        url: MEMBER_URL,
        status: 200,
      });

      expect(response.body).toMatchObject({ id: INES.id, twoStepVerificationEnabled: false });
    });

    it('leaves twoStepVerificationEnabled out when organization-service does not send it, as for a member or a guest', async () => {
      application.organization.listMembers.mockResolvedValue({ ...PAGE });

      const response = await runRouteCase(application, identity, {
        name: 'no column',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'members-token',
        status: 200,
      });

      for (const item of (response.body as { items: Record<string, unknown>[] }).items) {
        expect(item).not.toHaveProperty('twoStepVerificationEnabled');
      }
    });
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  describe('credentials', () => {
    it('reads the members in the organization of the token, as its user, with its scopes', async () => {
      let context: OrganizationContext | undefined;
      application.organization.listMembers.mockImplementation(() => {
        context = getOrganizationContext();
        return Promise.resolve({ ...PAGE });
      });

      const response: request.Response = await runRouteCase(application, identity, {
        name: 'token',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'members-token',
        status: 200,
      });

      expect(response.body).toEqual(PAGE);
      expect(context).toEqual({
        organizationId: ATELIER_NORD_ID,
        actor: { type: 'user', id: CAMILLE.id },
        role: 'owner',
        scopes: ['members:read'],
      });
      expect(identity.introspectApiToken).toHaveBeenCalledWith(MEMBERS_TOKEN);
      expect(identity.introspect).not.toHaveBeenCalled();
      expect(application.counter.consume).toHaveBeenCalledWith(
        `api-token:${MEMBERS_API_TOKEN.apiTokenId}`,
      );
    });

    it('reads the members in the current organization of the session, with every scope', async () => {
      let context: OrganizationContext | undefined;
      application.organization.listMembers.mockImplementation(() => {
        context = getOrganizationContext();
        return Promise.resolve({ ...PAGE });
      });

      await runRouteCase(application, identity, {
        name: 'session',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        status: 200,
      });

      expect(context).toEqual({
        organizationId: ATELIER_NORD_ID,
        actor: { type: 'user', id: CAMILLE.id },
        role: 'owner',
        scopes: ALL_SCOPES,
      });
      expect(application.counter.consume).toHaveBeenCalledWith(
        `session:${CAMILLE_ORGANIZATION_SESSION.sessionId}`,
      );
    });

    it('authenticates a request with a bearer token alone and ignores its cookie', async () => {
      const response: request.Response = await runRouteCase(application, identity, {
        name: 'both',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: { cookie: CAMILLE_ORGANIZATION_TOKEN, bearer: `Bearer ${TASKS_TOKEN}` },
        status: 403,
        code: 'auth.scope-missing',
      });

      expect(response.body).toMatchObject({ details: { requiredScopes: ['members:read'] } });
      expect(identity.introspect).not.toHaveBeenCalled();
    });

    it('answers 401 auth.api-token-invalid for a malformed bearer token, without calling identity-service, even with a valid cookie', async () => {
      await runRouteCase(application, identity, {
        name: 'malformed',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: { cookie: CAMILLE_ORGANIZATION_TOKEN, bearer: 'Bearer not-a-token' },
        status: 401,
        code: 'auth.api-token-invalid',
      });

      expect(identity.introspectApiToken).not.toHaveBeenCalled();
      expect(identity.introspect).not.toHaveBeenCalled();
    });

    describe('failed bearer tokens per client address', () => {
      /**
       * Constant FORWARDED
       *
       * @description
       * `X-Forwarded-For` as Traefik sends it: the entry the client wrote, then the address it saw.
       *
       * @type {Readonly<Record<string, string>>}
       */
      const FORWARDED: Readonly<Record<string, string>> = {
        'X-Forwarded-For': '198.51.100.23, 86.247.12.30',
      };

      it('reads the failures of the address Traefik saw, then counts an inactive token as one, on a pseudonym', async () => {
        application.logLines.length = 0;

        await runRouteCase(application, identity, {
          name: 'revoked',
          method: 'get',
          path: '/v1/members',
          url: '/v1/members',
          credential: { bearer: 'Bearer cw_pat_RevokedTokenOfSomebody00000000000000' },
          headers: FORWARDED,
          status: 401,
          code: 'auth.api-token-invalid',
        });

        const read: string | undefined = application.bearerFailureCounter.peek.mock.calls[0]?.[0];
        expect(read).toMatch(/^bearer-failures:[\w-]{22}$/u);
        expect(application.bearerFailureCounter.consume.mock.calls).toEqual([[read]]);
        expect(application.bearerFailureCounter.peek.mock.invocationCallOrder[0]).toBeLessThan(
          identity.introspectApiToken.mock.invocationCallOrder[0] ?? 0,
        );
        expect(application.counter.consume).not.toHaveBeenCalled();
        expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
        const logs: string = application.logLines.join('\n');
        expect(logs).not.toContain('86.247.12.30');
        expect(logs).not.toContain(read?.slice('bearer-failures:'.length));
      });

      it('counts a malformed bearer token as a failure of the address without calling identity-service', async () => {
        await runRouteCase(application, identity, {
          name: 'malformed',
          method: 'get',
          path: '/v1/members',
          url: '/v1/members',
          credential: { bearer: 'Bearer not-a-token' },
          headers: FORWARDED,
          status: 401,
          code: 'auth.api-token-invalid',
        });

        expect(application.bearerFailureCounter.consume).toHaveBeenCalledTimes(1);
        expect(identity.introspectApiToken).not.toHaveBeenCalled();
      });

      it('answers 429 rate-limit.exceeded with Retry-After before any introspection once the address has used its failures, a valid token too', async () => {
        application.bearerFailureCounter.peek.mockResolvedValue({
          allowed: false,
          retryAfterSeconds: 19,
        });

        const response: request.Response = await runRouteCase(application, identity, {
          name: 'throttled',
          method: 'get',
          path: '/v1/members',
          url: '/v1/members',
          credential: 'members-token',
          headers: FORWARDED,
          status: 429,
          code: 'rate-limit.exceeded',
        });

        expect(response.body).toEqual({
          type: 'about:blank',
          title: 'Trop de requêtes : réessayez dans un instant.',
          status: 429,
          code: 'rate-limit.exceeded',
          detail:
            'Too many failed personal API token authentications from this client; retry after the delay of Retry-After.',
        });
        expect(response.headers['retry-after']).toBe('19');
        expect(identity.introspectApiToken).not.toHaveBeenCalled();
        expect(application.bearerFailureCounter.consume).not.toHaveBeenCalled();
        expect(application.counter.consume).not.toHaveBeenCalled();
        expect(application.organization.listMembers).not.toHaveBeenCalled();
      });

      it('counts no failure for a valid token, which keeps only the limit of the token', async () => {
        application.organization.listMembers.mockResolvedValue({ ...PAGE });

        await runRouteCase(application, identity, {
          name: 'valid token',
          method: 'get',
          path: '/v1/members',
          url: '/v1/members',
          credential: 'members-token',
          headers: FORWARDED,
          status: 200,
        });

        expect(application.bearerFailureCounter.consume).not.toHaveBeenCalled();
        expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
        expect(application.counter.consume).toHaveBeenCalledWith(
          `api-token:${MEMBERS_API_TOKEN.apiTokenId}`,
        );
      });

      it('counts no failure for an active token that lacks the scope', async () => {
        await runRouteCase(application, identity, {
          name: 'scope',
          method: 'get',
          path: '/v1/members',
          url: '/v1/members',
          credential: 'tasks-token',
          headers: FORWARDED,
          status: 403,
          code: 'auth.scope-missing',
        });

        expect(application.bearerFailureCounter.consume).not.toHaveBeenCalled();
      });

      it('leaves a session alone: its address is neither read nor counted, even past the failures of the address', async () => {
        application.organization.listMembers.mockResolvedValue({ ...PAGE });
        application.bearerFailureCounter.peek.mockResolvedValue({
          allowed: false,
          retryAfterSeconds: 19,
        });

        await runRouteCase(application, identity, {
          name: 'session',
          method: 'get',
          path: '/v1/members',
          url: '/v1/members',
          headers: FORWARDED,
          status: 200,
        });

        expect(application.bearerFailureCounter.peek).not.toHaveBeenCalled();
        expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
      });
    });

    it('lets another Authorization scheme fall back to the session cookie', async () => {
      application.organization.listMembers.mockResolvedValue({ ...PAGE });

      await runRouteCase(application, identity, {
        name: 'basic',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: { cookie: CAMILLE_ORGANIZATION_TOKEN, bearer: 'Basic dXNlcjpwYXNz' },
        status: 200,
      });

      expect(identity.introspectApiToken).not.toHaveBeenCalled();
    });

    it('answers 403 organization.not-selected to a session without a current organization, calling nothing', async () => {
      const response: request.Response = await runRouteCase(application, identity, {
        name: 'no organization',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'session-without-organization',
        status: 403,
        code: 'organization.not-selected',
      });

      expect(response.body).toMatchObject({ title: 'Choisissez une organisation pour continuer.' });
      expect(application.organization.listMembers).not.toHaveBeenCalled();
      expect(application.counter.consume).not.toHaveBeenCalled();
    });

    it('needs no Origin for a bearer token on an unsafe route, which still refuses the token', async () => {
      await runRouteCase(application, identity, {
        name: 'bearer without origin',
        method: 'delete',
        path: '/v1/members/{memberId}',
        url: MEMBER_URL,
        credential: 'members-token',
        origin: null,
        status: 403,
        code: 'auth.api-token-not-accepted',
      });
    });

    it.each([
      ['another Origin', { origin: 'https://evil.test', contentType: undefined }],
      ['a form body', { origin: ALLOWED_ORIGIN, contentType: 'application/x-www-form-urlencoded' }],
    ])(
      'refuses an unsafe cookie request with %s before the introspection',
      async (_label, { origin, contentType }) => {
        let pending: request.Test = request(application.server)
          .patch(MEMBER_URL)
          .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
          .set('Origin', origin);
        if (contentType !== undefined) {
          pending = pending.set('Content-Type', contentType);
        }
        const response: request.Response = await pending.send('role=admin');

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: 'auth.csrf-rejected' });
        expect(identity.introspect).not.toHaveBeenCalled();
      },
    );
  });

  it('writes neither the token, the cookie nor an address of a member into the logs', async () => {
    application.organization.listMembers.mockResolvedValue({ ...PAGE });
    application.logLines.length = 0;

    await runRouteCase(application, identity, {
      name: 'token',
      method: 'get',
      path: '/v1/members',
      url: '/v1/members?search=ines.robert%40ateliernord.fr',
      credential: 'members-token',
      status: 200,
    });
    await runRouteCase(application, identity, {
      name: 'session',
      method: 'get',
      path: '/v1/members',
      url: '/v1/members',
      status: 200,
    });

    const logs: string = application.logLines.join('\n');
    expect(logs).not.toContain(MEMBERS_TOKEN);
    expect(logs).not.toContain(CAMILLE_ORGANIZATION_TOKEN);
    expect(logs).not.toContain(INES.email);
    expect(logs).not.toContain('ines.robert%40ateliernord.fr');
    const completion = application.logLines
      .map((line: string) => JSON.parse(line) as Record<string, unknown>)
      .find((line: Record<string, unknown>) => line.route === '/v1/members');
    expect(completion).toMatchObject({ organizationId: ATELIER_NORD_ID, userId: CAMILLE.id });
  });
});
