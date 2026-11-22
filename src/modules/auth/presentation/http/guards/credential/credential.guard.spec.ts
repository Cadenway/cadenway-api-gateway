import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_SESSION,
  createFakeIdentity,
  MEMBERS_API_TOKEN,
  type FakeIdentity,
  type IntrospectedApiToken,
  type IntrospectedSession,
} from '../../../../../../../tests/support/fake-identity.js';
import { CAMILLE_MEMBER, INES } from '../../../../../../../tests/support/fake-organization.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { runRouteCase, type RouteCase } from '../../../../../../../tests/support/route-cases.js';

/**
 * Constant WITHHELD
 *
 * @description
 * The organization identity-service withholds for want of two-step verification: Atelier Nord.
 *
 * @type {{ organizationId: string; code: string }}
 */
const WITHHELD: { organizationId: string; code: string } = {
  organizationId: ATELIER_NORD_ID,
  code: 'organization.mfa-required',
};

/**
 * Constant WITHHELD_SESSION
 *
 * @description
 * Camille's session once Atelier Nord requires two-step verification of her role and she has
 * none, as the contract has the introspection answer it: no organization, no role.
 *
 * @type {IntrospectedSession}
 */
const WITHHELD_SESSION: IntrospectedSession = {
  ...CAMILLE_SESSION,
  withheldOrganization: WITHHELD,
};

/**
 * Constant WITHHELD_SESSION_WITH_ORGANIZATION
 *
 * @description
 * A withheld session whose introspection still names the organization and the role, which the
 * contract rules out: the gateway must not build an organization context from it either.
 *
 * @type {IntrospectedSession}
 */
const WITHHELD_SESSION_WITH_ORGANIZATION: IntrospectedSession = {
  ...CAMILLE_ORGANIZATION_SESSION,
  withheldOrganization: WITHHELD,
};

/**
 * Constant WITHHELD_TOKEN
 *
 * @description
 * Camille's personal API token with `members:read` once Atelier Nord withholds itself: active,
 * with no scope, the organization named in `withheldOrganization`.
 *
 * @type {IntrospectedApiToken}
 */
const WITHHELD_TOKEN: IntrospectedApiToken = {
  ...MEMBERS_API_TOKEN,
  scopes: [],
  withheldOrganization: WITHHELD,
};

/**
 * Constant MFA_REQUIRED
 *
 * @description
 * The public problem of a withheld organization.
 *
 * @type {Record<string, unknown>}
 */
const MFA_REQUIRED: Record<string, unknown> = {
  type: 'about:blank',
  title:
    'Cette organisation exige la vérification en deux étapes : configurez-la depuis votre compte.',
  status: 403,
  code: 'organization.mfa-required',
  details: { organizationId: ATELIER_NORD_ID },
};

/**
 * Constant ORGANIZATION_ROUTES
 *
 * @description
 * Routes that act on the current organization, each refused to a withheld session before any
 * internal call.
 *
 * @type {readonly RouteCase[]}
 */
const ORGANIZATION_ROUTES: readonly RouteCase[] = [
  {
    name: 'GET /v1/organization',
    method: 'get',
    path: '/v1/organization',
    url: '/v1/organization',
    status: 403,
  },
  { name: 'GET /v1/members', method: 'get', path: '/v1/members', url: '/v1/members', status: 403 },
  {
    name: 'POST /v1/api-tokens',
    method: 'post',
    path: '/v1/api-tokens',
    url: '/v1/api-tokens',
    body: { name: 'Synchronisation GitLab', scopes: ['tasks:read'], expiration: '30-days' },
    status: 403,
  },
  {
    name: 'GET /v1/organization/authentication-policy',
    method: 'get',
    path: '/v1/organization/authentication-policy',
    url: '/v1/organization/authentication-policy',
    status: 403,
  },
];

describe('CredentialGuard and the organization withheld for want of two-step verification', () => {
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

  it.each(['session', 'members-token'] as const)(
    'applies the pre-introspection rate limit before verifying a %s',
    async (credential) => {
      application.introspectionCounter.consume.mockResolvedValueOnce({
        allowed: false,
        retryAfterSeconds: 12,
      });
      const response = await runRouteCase(application, identity, {
        name: 'pre-introspection admission',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential,
        status: 429,
        code: 'rate-limit.exceeded',
      });

      expect(response.headers['retry-after']).toBe('12');
      expect(identity.introspect).not.toHaveBeenCalled();
      expect(identity.introspectApiToken).not.toHaveBeenCalled();
      expect(application.counter.consume).not.toHaveBeenCalled();
      expect(application.introspectionCounter.consume).toHaveBeenCalledWith(
        expect.stringMatching(/^introspection:[A-Za-z0-9_-]{22}$/u),
      );
    },
  );

  describe('a withheld session', () => {
    it.each(
      ORGANIZATION_ROUTES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const),
    )(
      'gets 403 organization.mfa-required on %s, before organization.not-selected, calling nothing',
      async (_name, routeCase) => {
        identity.introspect.mockResolvedValue(WITHHELD_SESSION);

        const response = await runRouteCase(application, identity, {
          ...routeCase,
          code: 'organization.mfa-required',
        });

        expect(response.body).toMatchObject(MFA_REQUIRED);
        expect(application.organization.getOrganization).not.toHaveBeenCalled();
        expect(application.organization.listMembers).not.toHaveBeenCalled();
        expect(identity.createApiToken).not.toHaveBeenCalled();
        expect(identity.getAuthenticationPolicy).not.toHaveBeenCalled();
      },
    );

    it('gets 403 organization.mfa-required even when the introspection still names the organization', async () => {
      identity.introspect.mockResolvedValue(WITHHELD_SESSION_WITH_ORGANIZATION);

      const response = await runRouteCase(application, identity, {
        name: 'withheld with organization',
        method: 'get',
        path: '/v1/organization',
        url: '/v1/organization',
        status: 403,
        code: 'organization.mfa-required',
      });

      expect(response.body).toMatchObject(MFA_REQUIRED);
      expect(application.organization.getOrganization).not.toHaveBeenCalled();
    });

    it.each([
      ['a session without organization', WITHHELD_SESSION],
      [
        'a session whose introspection still names the organization',
        WITHHELD_SESSION_WITH_ORGANIZATION,
      ],
    ] as const)(
      'is served on GET /v1/me, with no organization context, for %s',
      async (_name, session) => {
        identity.introspect.mockResolvedValue(session);
        let context: OrganizationContext | undefined;
        identity.getUser.mockImplementation(() => {
          context = getOrganizationContext();
          return Promise.resolve({ ...CAMILLE });
        });

        await runRouteCase(application, identity, {
          name: 'me',
          method: 'get',
          path: '/v1/me',
          url: '/v1/me',
          status: 200,
        });

        expect(identity.getUser).toHaveBeenCalledWith(CAMILLE.id);
        expect(context).toMatchObject({
          organizationId: null,
          role: null,
          actor: { type: 'user', id: CAMILLE.id },
        });
      },
    );

    it('is served on GET /v1/me/two-step-verification, so that the person sets it up', async () => {
      identity.introspect.mockResolvedValue(WITHHELD_SESSION);
      identity.getTwoStepVerification.mockResolvedValue({
        enabled: false,
        primaryMethod: null,
        methods: [],
        authenticatorApp: null,
        securityKeys: [],
        backupCodes: null,
        requiredBy: [{ organizationId: ATELIER_NORD_ID, requiredFor: 'everyone' }],
      });

      const response = await runRouteCase(application, identity, {
        name: 'two-step verification',
        method: 'get',
        path: '/v1/me/two-step-verification',
        url: '/v1/me/two-step-verification',
        status: 200,
      });

      expect(response.body).toMatchObject({
        enabled: false,
        requiredBy: [{ organizationId: ATELIER_NORD_ID, requiredFor: 'everyone' }],
      });
      expect(identity.getTwoStepVerification).toHaveBeenCalledWith(CAMILLE.id);
    });

    it('may choose an organization: PUT /v1/session/organization needs none', async () => {
      identity.introspect.mockResolvedValue(WITHHELD_SESSION);
      identity.switchSessionOrganization.mockResolvedValue({
        organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b99',
        role: 'member',
      });

      await runRouteCase(application, identity, {
        name: 'choice',
        method: 'put',
        path: '/v1/session/organization',
        url: '/v1/session/organization',
        body: { organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b99' },
        status: 200,
      });

      expect(identity.switchSessionOrganization).toHaveBeenCalledWith(
        CAMILLE_SESSION.sessionId,
        '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b99',
      );
    });

    it('is refused before the rate limit, which counts nothing for it', async () => {
      identity.introspect.mockResolvedValue(WITHHELD_SESSION);

      await runRouteCase(application, identity, {
        name: 'counted',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        status: 403,
        code: 'organization.mfa-required',
      });

      expect(application.counter.consume).not.toHaveBeenCalled();
      expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
    });
  });

  describe('a withheld personal API token', () => {
    it('gets 403 organization.mfa-required on GET /v1/members, not auth.scope-missing', async () => {
      identity.introspectApiToken.mockResolvedValue(WITHHELD_TOKEN);

      const response = await runRouteCase(application, identity, {
        name: 'withheld token',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'members-token',
        status: 403,
        code: 'organization.mfa-required',
      });

      expect(response.body).toMatchObject(MFA_REQUIRED);
      expect(application.organization.listMembers).not.toHaveBeenCalled();
    });

    it('gets 403 organization.mfa-required on GET /v1/members/{memberId} too', async () => {
      identity.introspectApiToken.mockResolvedValue(WITHHELD_TOKEN);

      await runRouteCase(application, identity, {
        name: 'withheld token, one member',
        method: 'get',
        path: '/v1/members/{memberId}',
        url: `/v1/members/${INES.id}`,
        credential: 'members-token',
        status: 403,
        code: 'organization.mfa-required',
      });

      expect(application.organization.getMember).not.toHaveBeenCalled();
    });

    it('gets 403 auth.api-token-not-accepted on a session-only route: the kind of credential is checked first', async () => {
      identity.introspectApiToken.mockResolvedValue(WITHHELD_TOKEN);

      await runRouteCase(application, identity, {
        name: 'withheld token on /v1/me',
        method: 'get',
        path: '/v1/me',
        url: '/v1/me',
        credential: 'members-token',
        status: 403,
        code: 'auth.api-token-not-accepted',
      });

      expect(identity.getUser).not.toHaveBeenCalled();
    });

    it('leaves a token that is not withheld to the scope check: auth.scope-missing without the scope', async () => {
      await runRouteCase(application, identity, {
        name: 'scope missing',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'tasks-token',
        status: 403,
        code: 'auth.scope-missing',
      });

      expect(application.organization.listMembers).not.toHaveBeenCalled();
    });

    it('serves a token that is not withheld, with its organization', async () => {
      application.organization.listMembers.mockResolvedValue({
        items: [CAMILLE_MEMBER],
        nextCursor: null,
        total: 1,
        counts: { owner: 1, admin: 0, member: 0, guest: 0 },
      });

      await runRouteCase(application, identity, {
        name: 'token served',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'members-token',
        status: 200,
      });

      expect(application.organization.listMembers).toHaveBeenCalledTimes(1);
    });
  });

  describe('a withheld organization under a code the public contracts do not declare', () => {
    const future: { organizationId: string; code: string } = {
      organizationId: ATELIER_NORD_ID,
      code: 'organization.sso-required',
    };

    it('refuses a session on an organization route as organization.not-selected, never with the undeclared code', async () => {
      identity.introspect.mockResolvedValue({
        ...CAMILLE_ORGANIZATION_SESSION,
        withheldOrganization: future,
      });

      const response = await runRouteCase(application, identity, {
        name: 'unknown withheld code, session',
        method: 'get',
        path: '/v1/organization',
        url: '/v1/organization',
        status: 403,
        code: 'organization.not-selected',
      });

      expect(JSON.stringify(response.body)).not.toContain('sso-required');
      expect(application.organization.getOrganization).not.toHaveBeenCalled();
    });

    it('refuses a token as auth.scope-missing, never with the undeclared code', async () => {
      identity.introspectApiToken.mockResolvedValue({
        ...MEMBERS_API_TOKEN,
        withheldOrganization: future,
      });

      const response = await runRouteCase(application, identity, {
        name: 'unknown withheld code, token',
        method: 'get',
        path: '/v1/members',
        url: '/v1/members',
        credential: 'members-token',
        status: 403,
        code: 'auth.scope-missing',
      });

      expect(JSON.stringify(response.body)).not.toContain('sso-required');
      expect(application.organization.listMembers).not.toHaveBeenCalled();
    });
  });
});
