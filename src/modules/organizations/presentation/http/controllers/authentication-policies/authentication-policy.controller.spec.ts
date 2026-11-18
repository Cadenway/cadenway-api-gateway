import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_SESSION,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
  type IntrospectedSession,
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
 * Constant PATH
 *
 * @description
 * Path of the authentication policy of the current organization.
 *
 * @type {string}
 */
const PATH: string = '/v1/organization/authentication-policy';

/**
 * Constant POLICY
 *
 * @description
 * The policy of Atelier Nord in the mockup, as identity-service answers it.
 *
 * @type {{ twoStepVerificationRequiredFor: string; sessionInactivityTimeoutMinutes: number; membersWithoutTwoStepVerification: { admins: number; everyone: number }; version: number }}
 */
const POLICY: {
  twoStepVerificationRequiredFor: string;
  sessionInactivityTimeoutMinutes: number;
  membersWithoutTwoStepVerification: { admins: number; everyone: number };
  version: number;
} = {
  twoStepVerificationRequiredFor: 'admins',
  sessionInactivityTimeoutMinutes: 720,
  membersWithoutTwoStepVerification: { admins: 0, everyone: 7 },
  version: 2,
};

/**
 * Constant WITHHELD_SESSION
 *
 * @description
 * Camille's session once Atelier Nord requires two-step verification of her role and she has
 * none: no organization, no role, and the organization named in `withheldOrganization`.
 *
 * @type {IntrospectedSession}
 */
const WITHHELD_SESSION: IntrospectedSession = {
  ...CAMILLE_SESSION,
  withheldOrganization: { organizationId: ATELIER_NORD_ID, code: 'organization.mfa-required' },
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
 * Constant GET_CASES
 *
 * @description
 * The success and every declared error of `GET /v1/organization/authentication-policy`.
 *
 * @type {readonly RouteCase[]}
 */
const GET_CASES: readonly RouteCase[] = [
  {
    name: 'GET reads the policy of the current organization with its ETag',
    method: 'get',
    path: PATH,
    url: PATH,
    arrange: ({ identity }) => identity.getAuthenticationPolicy.mockResolvedValue({ ...POLICY }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(POLICY);
      expect(response.headers.etag).toBe('"2"');
      expect(identity.getAuthenticationPolicy).toHaveBeenCalledTimes(1);
    },
  },
  {
    name: 'GET answers 401 without a credential',
    method: 'get',
    path: PATH,
    url: PATH,
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'GET answers 403 organization.not-selected to a session without an organization, calling nothing',
    method: 'get',
    path: PATH,
    url: PATH,
    credential: 'session-without-organization',
    status: 403,
    code: 'organization.not-selected',
    check: (_response, { identity }) => {
      expect(identity.getAuthenticationPolicy).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET answers 403 organization.mfa-required to a session whose organization is withheld, calling nothing',
    method: 'get',
    path: PATH,
    url: PATH,
    arrange: ({ identity }) => identity.introspect.mockResolvedValue(WITHHELD_SESSION),
    status: 403,
    code: 'organization.mfa-required',
    check: (response, { identity }) => {
      expect(response.body).toMatchObject(MFA_REQUIRED);
      expect(identity.getAuthenticationPolicy).not.toHaveBeenCalled();
    },
  },
  {
    name: 'GET relays 403 organization.role-forbidden to a member',
    method: 'get',
    path: PATH,
    url: PATH,
    arrange: ({ identity }) =>
      identity.getAuthenticationPolicy.mockRejectedValue(
        identityProblem(403, 'organization.role-forbidden'),
      ),
    status: 403,
    code: 'organization.role-forbidden',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Votre rôle ne permet pas cette action.' });
    },
  },
  {
    name: 'GET refuses a personal API token',
    method: 'get',
    path: PATH,
    url: PATH,
    credential: 'members-token',
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'GET relays 404 organization.not-found',
    method: 'get',
    path: PATH,
    url: PATH,
    arrange: ({ identity }) =>
      identity.getAuthenticationPolicy.mockRejectedValue(
        identityProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'GET answers 429 beyond the quota of the session',
    method: 'get',
    path: PATH,
    url: PATH,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET answers 503 when identity-service cannot answer',
    method: 'get',
    path: PATH,
    url: PATH,
    arrange: ({ identity }) =>
      identity.getAuthenticationPolicy.mockRejectedValue(identityUnavailable()),
    status: 503,
    code: 'upstream.unavailable',
  },
];

/**
 * Constant PATCH_CASES
 *
 * @description
 * The success and every declared error of `PATCH /v1/organization/authentication-policy`.
 *
 * @type {readonly RouteCase[]}
 */
const PATCH_CASES: readonly RouteCase[] = [
  {
    name: 'PATCH changes the policy with the session of the introspection and If-Match unchanged',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'admins' },
    headers: { 'If-Match': '"1"' },
    arrange: ({ identity }) => identity.updateAuthenticationPolicy.mockResolvedValue({ ...POLICY }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(POLICY);
      expect(response.headers.etag).toBe('"2"');
      expect(identity.updateAuthenticationPolicy).toHaveBeenCalledWith(
        CAMILLE_ORGANIZATION_SESSION.sessionId,
        { twoStepVerificationRequiredFor: 'admins' },
        '"1"',
      );
    },
  },
  {
    name: 'PATCH sends only the members of the patch, and no If-Match when there is none',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { sessionInactivityTimeoutMinutes: 60 },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockResolvedValue({
        ...POLICY,
        sessionInactivityTimeoutMinutes: 60,
        version: 3,
      }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.headers.etag).toBe('"3"');
      expect(identity.updateAuthenticationPolicy).toHaveBeenCalledWith(
        CAMILLE_ORGANIZATION_SESSION.sessionId,
        { sessionInactivityTimeoutMinutes: 60 },
        undefined,
      );
    },
  },
  {
    name: 'PATCH refuses a value the contract does not list before any call',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { sessionInactivityTimeoutMinutes: 30 },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.updateAuthenticationPolicy).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH relays 400 request.invalid of identity-service',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'everyone' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
        identityProblem(400, 'request.invalid', {
          issues: [{ in: 'header', path: 'If-Match', code: 'invalid_format', message: 'Invalid' }],
        }),
      ),
    status: 400,
    code: 'request.invalid',
    check: (response) => {
      expect(response.body).not.toHaveProperty('details.service');
    },
  },
  {
    name: 'PATCH answers 401 without a credential',
    method: 'patch',
    path: PATH,
    url: PATH,
    credential: 'none',
    body: { twoStepVerificationRequiredFor: 'admins' },
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'PATCH answers 404 session.not-found as 401 auth.session-expired',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'admins' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
        identityProblem(404, 'session.not-found'),
      ),
    status: 401,
    code: 'auth.session-expired',
  },
  {
    name: 'PATCH answers 403 organization.not-selected to a session without an organization, calling nothing',
    method: 'patch',
    path: PATH,
    url: PATH,
    credential: 'session-without-organization',
    body: { twoStepVerificationRequiredFor: 'admins' },
    status: 403,
    code: 'organization.not-selected',
    check: (_response, { identity }) => {
      expect(identity.updateAuthenticationPolicy).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH answers 403 organization.mfa-required to a session whose organization is withheld, calling nothing',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'nobody' },
    arrange: ({ identity }) => identity.introspect.mockResolvedValue(WITHHELD_SESSION),
    status: 403,
    code: 'organization.mfa-required',
    check: (response, { identity }) => {
      expect(response.body).toMatchObject(MFA_REQUIRED);
      expect(identity.updateAuthenticationPolicy).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH relays 403 organization.role-forbidden to a member',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'nobody' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
        identityProblem(403, 'organization.role-forbidden'),
      ),
    status: 403,
    code: 'organization.role-forbidden',
  },
  {
    name: 'PATCH relays 403 auth.reauthentication-required with details.methods and its French title',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'nobody' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
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
    name: 'PATCH refuses a personal API token',
    method: 'patch',
    path: PATH,
    url: PATH,
    credential: 'members-token',
    origin: null,
    body: { twoStepVerificationRequiredFor: 'admins' },
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'PATCH refuses a cookie request from another origin before the introspection',
    method: 'patch',
    path: PATH,
    url: PATH,
    origin: 'https://evil.test',
    body: { twoStepVerificationRequiredFor: 'admins' },
    status: 403,
    code: 'auth.csrf-rejected',
    check: (_response, { identity }) => {
      expect(identity.introspect).not.toHaveBeenCalled();
    },
  },
  {
    name: 'PATCH relays 404 organization.not-found',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'admins' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
        identityProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'PATCH relays 409 auth.two-step-not-enabled to an editor without two-step verification',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'everyone' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
        identityProblem(409, 'auth.two-step-not-enabled'),
      ),
    status: 409,
    code: 'auth.two-step-not-enabled',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Activez d’abord la vérification en deux étapes.',
        status: 409,
        code: 'auth.two-step-not-enabled',
      });
    },
  },
  {
    name: 'PATCH relays 412 request.version-mismatch with the current version',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'admins' },
    headers: { 'If-Match': '"1"' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(
        identityProblem(412, 'request.version-mismatch', { version: 2 }),
      ),
    status: 412,
    code: 'request.version-mismatch',
    check: (response) => {
      expect(response.body).toMatchObject({ details: { version: 2 } });
    },
  },
  {
    name: 'PATCH answers 429 beyond the quota of the session',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'admins' },
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'PATCH answers 503 when identity-service cannot answer',
    method: 'patch',
    path: PATH,
    url: PATH,
    body: { twoStepVerificationRequiredFor: 'admins' },
    arrange: ({ identity }) =>
      identity.updateAuthenticationPolicy.mockRejectedValue(identityUnavailable('timeout')),
    status: 503,
    code: 'upstream.timeout',
  },
];

describe('routes of /v1/organization/authentication-policy', () => {
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
    expectEveryDeclaredStatus([...GET_CASES, ...PATCH_CASES]);
  });

  it.each(
    [...GET_CASES, ...PATCH_CASES].map(
      (routeCase: RouteCase) => [routeCase.name, routeCase] as const,
    ),
  )('%s', async (_name, routeCase) => {
    await runRouteCase(application, identity, routeCase);
  });

  it('calls identity-service as the user of the session, in its current organization', async () => {
    let context: OrganizationContext | undefined;
    identity.getAuthenticationPolicy.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve({ ...POLICY });
    });

    await runRouteCase(application, identity, {
      name: 'context',
      method: 'get',
      path: PATH,
      url: PATH,
      status: 200,
    });

    expect(context).toMatchObject({
      organizationId: ATELIER_NORD_ID,
      actor: { type: 'user', id: CAMILLE.id },
      role: 'owner',
    });
  });
});
