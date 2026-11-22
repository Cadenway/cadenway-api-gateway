import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_ORGANIZATION_TOKEN,
  CAMILLE_SESSION,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  ATELIER_NORD,
  MY_ATELIER_NORD,
} from '../../../../../../../tests/support/fake-organization.js';
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
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';

/**
 * Function organizationProblem
 *
 * @description
 * What the internal HTTP client throws for a client error of organization-service.
 *
 * @param {400 | 403 | 404 | 409 | 412 | 422 | 429} status - Status organization-service answered.
 * @param {string} code - Code of its problem.
 * @param {Readonly<Record<string, unknown>>} details - Details of its problem.
 * @returns {ReturnType<typeof identityProblem>} The problem.
 */
function organizationProblem(
  status: 400 | 403 | 404 | 409 | 412 | 422 | 429,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): ReturnType<typeof identityProblem> {
  return identityProblem(status, code, details, 'organization-service');
}

const CREATION_INVITE_RETRY_AT = new Date(Date.now() + 3_600_000).toISOString();
const STALE_ORGANIZATION_ID = '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31';

/**
 * Constant CREATION
 *
 * @description
 * A creation form, as the web application sends it.
 *
 * @type {Record<string, unknown>}
 */
const CREATION: Record<string, unknown> = {
  name: 'Atelier Nord',
  teamSize: '6-20',
  primaryUse: 'product-engineering',
  inviteEmails: ['ines.robert@ateliernord.fr'],
};

/**
 * Constant CREATED
 *
 * @description
 * Answer of organization-service to the creation.
 *
 * @type {{ organization: typeof ATELIER_NORD; invitations: { email: string; outcome: string; invitationId: string | null }[] }}
 */
const CREATED: {
  organization: typeof ATELIER_NORD;
  invitations: { email: string; outcome: string; invitationId: string | null }[];
} = {
  organization: { ...ATELIER_NORD, memberCount: 1, version: 1, description: null, website: null },
  invitations: [
    {
      email: 'ines.robert@ateliernord.fr',
      outcome: 'invited',
      invitationId: '019a6b10-3c4d-7e5f-8a6b-7c8d9e0f1a73',
    },
  ],
};

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each organization route.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/organizations creates the organization, with Location and ETag',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    credential: 'session-without-organization',
    body: { name: 'Atelier Nord' },
    arrange: ({ organization }) => organization.createOrganization.mockResolvedValue(CREATED),
    status: 201,
    check: (response, { organization }) => {
      expect(response.body).toEqual(CREATED);
      expect(response.headers.location).toBe('/v1/organization');
      expect(response.headers.etag).toBe('"1"');
      expect(organization.createOrganization).toHaveBeenCalledWith({
        name: 'Atelier Nord',
        teamSize: '6-20',
        primaryUse: 'product-engineering',
        inviteEmails: [],
      });
    },
  },
  {
    name: 'POST /v1/organizations refuses an invalid body before any call',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: { name: '', slug: 'Atelier Nord' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/organizations answers 401 without a credential',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    credential: 'none',
    body: CREATION,
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/organizations refuses a personal API token',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    credential: 'members-token',
    body: CREATION,
    origin: null,
    status: 403,
    code: 'auth.api-token-not-accepted',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Cette requête n’accepte pas de jeton d’API.',
      });
    },
  },
  {
    name: 'POST /v1/organizations relays 404 user.not-synchronized',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: CREATION,
    arrange: ({ organization }) =>
      organization.createOrganization.mockRejectedValue(
        organizationProblem(404, 'user.not-synchronized'),
      ),
    status: 404,
    code: 'user.not-synchronized',
    check: (response) => {
      expect(response.body).toMatchObject({
        title: 'Votre compte est en cours de préparation : réessayez dans un instant.',
      });
    },
  },
  {
    name: 'POST /v1/organizations relays 409 organization.slug-taken with the slug',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: CREATION,
    arrange: ({ organization }) =>
      organization.createOrganization.mockRejectedValue(
        organizationProblem(409, 'organization.slug-taken', { slug: 'atelier-nord' }),
      ),
    status: 409,
    code: 'organization.slug-taken',
    check: (response) => {
      expect(response.body).toMatchObject({ details: { slug: 'atelier-nord' } });
      expect(response.body).not.toHaveProperty('details.service');
    },
  },
  {
    name: 'POST /v1/organizations relays 422 organization.slug-invalid',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: { name: 'É' },
    arrange: ({ organization }) =>
      organization.createOrganization.mockRejectedValue(
        organizationProblem(422, 'organization.slug-invalid', { slug: 'e' }),
      ),
    status: 422,
    code: 'organization.slug-invalid',
  },
  {
    name: 'POST /v1/organizations answers 429 beyond the quota',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: CREATION,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/organizations relays the invitation budget with Retry-After',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: CREATION,
    arrange: ({ organization }) =>
      organization.createOrganization.mockRejectedValue(
        organizationProblem(429, 'invitation.daily-limit-reached', {
          remaining: 0,
          nextAvailableAt: CREATION_INVITE_RETRY_AT,
        }),
      ),
    status: 429,
    code: 'invitation.daily-limit-reached',
    check: (response) => {
      expect(response.body).toMatchObject({
        details: { remaining: 0, nextAvailableAt: CREATION_INVITE_RETRY_AT },
      });
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(response.headers.location).toBeUndefined();
    },
  },
  {
    name: 'POST /v1/organizations answers 503 when organization-service cannot answer',
    method: 'post',
    path: '/v1/organizations',
    url: '/v1/organizations',
    body: CREATION,
    arrange: ({ organization }) =>
      organization.createOrganization.mockRejectedValue(
        identityUnavailable('unavailable', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.unavailable',
  },
  {
    name: 'GET /v1/organizations answers the picker without a current organization',
    method: 'get',
    path: '/v1/organizations',
    url: '/v1/organizations?limit=10&cursor=abc',
    credential: 'session-without-organization',
    arrange: ({ organization }) =>
      organization.listMyOrganizations.mockResolvedValue({
        items: [{ ...MY_ATELIER_NORD }],
        nextCursor: null,
      }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toEqual({ items: [MY_ATELIER_NORD], nextCursor: null });
      expect(organization.listMyOrganizations).toHaveBeenCalledWith({ cursor: 'abc', limit: 10 });
    },
  },
  {
    name: 'GET /v1/organizations refuses a limit above 100',
    method: 'get',
    path: '/v1/organizations',
    url: '/v1/organizations?limit=101',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'GET /v1/organizations answers 401 for an ended session',
    method: 'get',
    path: '/v1/organizations',
    url: '/v1/organizations',
    credential: { cookie: 'ended' },
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'GET /v1/organizations refuses a personal API token',
    method: 'get',
    path: '/v1/organizations',
    url: '/v1/organizations',
    credential: 'members-token',
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'GET /v1/organizations answers 429 beyond the quota',
    method: 'get',
    path: '/v1/organizations',
    url: '/v1/organizations',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 1 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/organizations answers 503 when organization-service cannot answer',
    method: 'get',
    path: '/v1/organizations',
    url: '/v1/organizations',
    arrange: ({ organization }) =>
      organization.listMyOrganizations.mockRejectedValue(
        identityUnavailable('timeout', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.timeout',
  },
  {
    name: 'GET /v1/organization answers the current organization with its ETag',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    arrange: ({ organization }) => organization.getOrganization.mockResolvedValue(ATELIER_NORD),
    status: 200,
    check: (response) => {
      expect(response.body).toEqual(ATELIER_NORD);
      expect(response.headers.etag).toBe('"3"');
    },
  },
  {
    name: 'GET /v1/organization answers 401 without a credential',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'GET /v1/organization answers 403 organization.not-selected without a current organization',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    credential: 'session-without-organization',
    status: 403,
    code: 'organization.not-selected',
    check: (_response, { organization }) => {
      expect(organization.getOrganization).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET /v1/organization relays 404 organization.not-found',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    arrange: ({ organization }) =>
      organization.getOrganization.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Organisation introuvable.' });
    },
  },
  {
    name: 'GET /v1/organization refuses a stale expected organization before reading it',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    headers: { 'If-Organization-Match': STALE_ORGANIZATION_ID },
    status: 412,
    code: 'organization.context-changed',
    check: (_response, { organization }) => {
      expect(organization.getOrganization).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET /v1/organization answers 429 beyond the quota',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 2 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/organization answers another client error of organization-service as 503',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    arrange: ({ organization }) =>
      organization.getOrganization.mockRejectedValue(organizationProblem(400, 'request.invalid')),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'PATCH /v1/organization applies the patch, keeping null and relaying If-Match',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { description: null, website: 'https://ateliernord.fr', defaultLanguage: 'en' },
    headers: { 'If-Match': '"3"' },
    arrange: ({ organization }) =>
      organization.updateOrganization.mockResolvedValue({
        ...ATELIER_NORD,
        description: null,
        defaultLanguage: 'en',
        version: 4,
      }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.headers.etag).toBe('"4"');
      expect(organization.updateOrganization).toHaveBeenCalledWith(
        { description: null, website: 'https://ateliernord.fr', defaultLanguage: 'en' },
        '"3"',
      );
    },
  },
  {
    name: 'PATCH /v1/organization refuses a blank If-Match before any call',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { defaultLanguage: 'en' },
    headers: { 'If-Match': '' },
    status: 400,
    code: 'request.invalid',
    check: (response, { organization }) => {
      expect(response.body).toMatchObject({
        details: { issues: [{ in: 'header', path: 'If-Match' }] },
      });
      expect(organization.updateOrganization).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH /v1/organization refuses a description longer than 280 characters',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { description: 'x'.repeat(281) },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'PATCH /v1/organization answers 401 without a credential',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    credential: 'none',
    body: {},
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'PATCH /v1/organization relays 403 organization.role-forbidden',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { name: 'Atelier Sud' },
    arrange: ({ organization }) =>
      organization.updateOrganization.mockRejectedValue(
        organizationProblem(403, 'organization.role-forbidden'),
      ),
    status: 403,
    code: 'organization.role-forbidden',
  },
  {
    name: 'PATCH /v1/organization relays 404 organization.not-found',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { name: 'Atelier Sud' },
    arrange: ({ organization }) =>
      organization.updateOrganization.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'PATCH /v1/organization relays 409 organization.slug-taken',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { slug: 'studio-pivot' },
    arrange: ({ organization }) =>
      organization.updateOrganization.mockRejectedValue(
        organizationProblem(409, 'organization.slug-taken', { slug: 'studio-pivot' }),
      ),
    status: 409,
    code: 'organization.slug-taken',
  },
  {
    name: 'PATCH /v1/organization relays 412 request.version-mismatch',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { name: 'Atelier Sud' },
    headers: { 'If-Match': '"2"' },
    arrange: ({ organization }) =>
      organization.updateOrganization.mockRejectedValue(
        organizationProblem(412, 'request.version-mismatch', { version: 3 }),
      ),
    status: 412,
    code: 'request.version-mismatch',
  },
  {
    name: 'PATCH /v1/organization refuses a stale expected organization before writing',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: { defaultLanguage: 'en' },
    headers: { 'If-Match': '"3"', 'If-Organization-Match': STALE_ORGANIZATION_ID },
    status: 412,
    code: 'organization.context-changed',
    check: (_response, { organization }) => {
      expect(organization.updateOrganization).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH /v1/organization answers 429 beyond the quota',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: {},
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 4 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'PATCH /v1/organization answers 503 when organization-service cannot answer',
    method: 'patch',
    path: '/v1/organization',
    url: '/v1/organization',
    body: {},
    arrange: ({ organization }) =>
      organization.updateOrganization.mockRejectedValue(
        identityUnavailable('failed', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'PUT /v1/session/organization chooses the organization of the session of the cookie',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    credential: 'session-without-organization',
    body: { organizationId: ATELIER_NORD_ID },
    arrange: ({ identity }) =>
      identity.switchSessionOrganization.mockResolvedValue({
        organizationId: ATELIER_NORD_ID,
        role: 'owner',
      }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual({ organizationId: ATELIER_NORD_ID, role: 'owner' });
      expect(identity.switchSessionOrganization).toHaveBeenCalledWith(
        CAMILLE_SESSION.sessionId,
        ATELIER_NORD_ID,
      );
    },
  },
  {
    name: 'PUT /v1/session/organization refuses an id that is not a UUID',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    body: { organizationId: 'atelier-nord' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'PUT /v1/session/organization answers 401 auth.session-expired for a session that ended since its introspection',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    body: { organizationId: ATELIER_NORD_ID },
    arrange: ({ identity }) =>
      identity.switchSessionOrganization.mockRejectedValue(
        identityProblem(404, 'session.not-found'),
      ),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'PUT /v1/session/organization refuses a personal API token',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    credential: 'members-token',
    body: { organizationId: ATELIER_NORD_ID },
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'PUT /v1/session/organization relays 403 organization.mfa-required with the organization and its French title',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    credential: 'session-without-organization',
    body: { organizationId: ATELIER_NORD_ID },
    arrange: ({ identity }) =>
      identity.switchSessionOrganization.mockRejectedValue(
        identityProblem(403, 'organization.mfa-required', { organizationId: ATELIER_NORD_ID }),
      ),
    status: 403,
    code: 'organization.mfa-required',
    check: (response, { identity }) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title:
          'Cette organisation exige la vérification en deux étapes : configurez-la depuis votre compte.',
        status: 403,
        code: 'organization.mfa-required',
        details: { organizationId: ATELIER_NORD_ID },
      });
      expect(identity.switchSessionOrganization).toHaveBeenCalledWith(
        CAMILLE_SESSION.sessionId,
        ATELIER_NORD_ID,
      );
    },
  },
  {
    name: 'PUT /v1/session/organization relays 404 organization.not-found',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    body: { organizationId: ATELIER_NORD_ID },
    arrange: ({ identity }) =>
      identity.switchSessionOrganization.mockRejectedValue(
        identityProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'PUT /v1/session/organization answers 429 beyond the quota',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    body: { organizationId: ATELIER_NORD_ID },
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'PUT /v1/session/organization answers 503 when identity-service cannot answer',
    method: 'put',
    path: '/v1/session/organization',
    url: '/v1/session/organization',
    body: { organizationId: ATELIER_NORD_ID },
    arrange: ({ identity }) =>
      identity.switchSessionOrganization.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
];

describe('routes of organizations.yaml', () => {
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

  it('exercises every status each organization route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('reads the current organization in the organization of the session, from its introspection', async () => {
    let context: OrganizationContext | undefined;
    application.organization.getOrganization.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve(ATELIER_NORD);
    });

    await runRouteCase(application, identity, {
      name: 'context',
      method: 'get',
      path: '/v1/organization',
      url: '/v1/organization',
      status: 200,
    });

    expect(context).toMatchObject({
      organizationId: CAMILLE_ORGANIZATION_SESSION.organizationId,
      actor: { type: 'user', id: CAMILLE.id },
      role: 'owner',
    });
  });

  it('never writes an invited address into the logs', async () => {
    application.organization.createOrganization.mockResolvedValue(CREATED);
    application.logLines.length = 0;

    await runRouteCase(application, identity, {
      name: 'creation',
      method: 'post',
      path: '/v1/organizations',
      url: '/v1/organizations',
      body: CREATION,
      status: 201,
    });

    expect(application.logLines.join('\n')).not.toContain('ines.robert@ateliernord.fr');
  });

  it.each([
    ['put', '/v1/session/organization'],
    ['patch', '/v1/organization'],
    ['post', '/v1/organizations'],
  ] as const)(
    'refuses a bodiless %s %s without Content-Type before the introspection, as the contract requires JSON',
    async (method, url) => {
      const response: request.Response = await request(application.server)
        [method](url)
        .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
        .set('Origin', ALLOWED_ORIGIN);

      expectPublicResponse(method, url, response);
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'auth.csrf-rejected' });
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  );
});
