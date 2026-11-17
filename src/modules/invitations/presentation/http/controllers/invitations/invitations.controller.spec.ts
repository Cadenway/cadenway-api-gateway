import type request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { MARC_INVITATION } from '../../../../../../../tests/support/fake-organization.js';
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
 * Function organizationProblem
 *
 * @description
 * What the internal HTTP client throws for a client error of organization-service.
 *
 * @param {400 | 403 | 404 | 409 | 429} status - Status organization-service answered.
 * @param {string} code - Code of its problem.
 * @param {Readonly<Record<string, unknown>>} details - Details of its problem.
 * @returns {ReturnType<typeof identityProblem>} The problem.
 */
function organizationProblem(
  status: 400 | 403 | 404 | 409 | 429,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): ReturnType<typeof identityProblem> {
  return identityProblem(status, code, details, 'organization-service');
}

/**
 * Constant INVITATION_URL
 *
 * @description
 * URL of the pending invitation of Marc Roux.
 *
 * @type {string}
 */
const INVITATION_URL: string = `/v1/invitations/${MARC_INVITATION.id}`;

/**
 * Constant BATCH
 *
 * @description
 * An invitation batch, as the invite dialog sends it.
 *
 * @type {Record<string, unknown>}
 */
const BATCH: Record<string, unknown> = {
  emails: ['marc.roux@ateliernord.fr', 'ines.robert@ateliernord.fr'],
  role: 'guest',
};

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each invitation route of the current organization.
 *
 * @type {readonly RouteCase[]}
 */
/**
 * Constant RESEND_AVAILABLE_AT
 *
 * @description
 * When the email of a throttled invitation can go out again: about an hour after the tests start.
 *
 * @type {string}
 */
const RESEND_AVAILABLE_AT: string = new Date(Date.now() + 3_600_000).toISOString();

/**
 * Constant NEXT_AVAILABLE_AT
 *
 * @description
 * When the daily allowance of invitation emails grows again: about five hours after the tests
 * start.
 *
 * @type {string}
 */
const NEXT_AVAILABLE_AT: string = new Date(Date.now() + 18_000_000).toISOString();

/**
 * Function expectRetryAfterUntil
 *
 * @description
 * Checks that `Retry-After` gives the whole seconds left until an instant, rounded up, as the
 * contract says; the tests take a few seconds at most to reach the request.
 *
 * @param {request.Response} response - The response.
 * @param {string} instant - The instant the request can succeed.
 */
function expectRetryAfterUntil(response: request.Response, instant: string): void {
  const expected: number = Math.ceil((Date.parse(instant) - Date.now()) / 1000);
  const retryAfter: number = Number(response.headers['retry-after']);
  expect(retryAfter).toBeGreaterThanOrEqual(expected);
  expect(retryAfter).toBeLessThanOrEqual(expected + 5);
}

const CASES: readonly RouteCase[] = [
  {
    name: 'POST /v1/invitations answers the outcome of each address',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: { emails: ['marc.roux@ateliernord.fr', 'ines.robert@ateliernord.fr'] },
    arrange: ({ organization }) =>
      organization.inviteMembers.mockResolvedValue({
        invitations: [
          {
            email: 'marc.roux@ateliernord.fr',
            outcome: 'invited',
            invitationId: MARC_INVITATION.id,
          },
          { email: 'ines.robert@ateliernord.fr', outcome: 'already-member', invitationId: null },
        ],
      }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toMatchObject({
        invitations: [{ outcome: 'invited' }, { outcome: 'already-member', invitationId: null }],
      });
      expect(organization.inviteMembers).toHaveBeenCalledWith({
        emails: ['marc.roux@ateliernord.fr', 'ines.robert@ateliernord.fr'],
        role: 'member',
      });
    },
  },
  {
    name: 'POST /v1/invitations refuses an address that is not one before any call',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: { emails: ['marc.roux'], role: 'member' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/invitations answers 401 without a credential',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    credential: 'none',
    body: BATCH,
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/invitations relays 403 organization.role-forbidden for a member',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: BATCH,
    arrange: ({ organization }) =>
      organization.inviteMembers.mockRejectedValue(
        organizationProblem(403, 'organization.role-forbidden'),
      ),
    status: 403,
    code: 'organization.role-forbidden',
  },
  {
    name: 'POST /v1/invitations relays 404 organization.not-found',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: BATCH,
    arrange: ({ organization }) =>
      organization.inviteMembers.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'POST /v1/invitations answers 429 beyond the quota',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: BATCH,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 8 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/invitations answers 503 when organization-service cannot answer',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: BATCH,
    arrange: ({ organization }) =>
      organization.inviteMembers.mockRejectedValue(
        identityUnavailable('unreachable', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.unreachable',
  },
  {
    name: 'GET /v1/invitations answers the pending invitations with their total',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations?limit=5',
    arrange: ({ organization }) =>
      organization.listInvitations.mockResolvedValue({
        items: [{ ...MARC_INVITATION }, { ...MARC_INVITATION, status: 'expired' }],
        nextCursor: 'next',
        total: 7,
      }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toMatchObject({ nextCursor: 'next', total: 7 });
      expect(organization.listInvitations).toHaveBeenCalledWith({ limit: 5 });
    },
  },
  {
    name: 'GET /v1/invitations refuses a limit that is not a number',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations?limit=ten',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'GET /v1/invitations answers 401 without a credential',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations',
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'GET /v1/invitations answers 403 organization.not-selected without a current organization',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations',
    credential: 'session-without-organization',
    status: 403,
    code: 'organization.not-selected',
  },
  {
    name: 'GET /v1/invitations relays 404 organization.not-found',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations',
    arrange: ({ organization }) =>
      organization.listInvitations.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'organization.not-found',
  },
  {
    name: 'GET /v1/invitations answers 429 beyond the quota',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 8 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/invitations answers 503 when organization-service cannot answer',
    method: 'get',
    path: '/v1/invitations',
    url: '/v1/invitations',
    arrange: ({ organization }) =>
      organization.listInvitations.mockRejectedValue(
        identityUnavailable('timeout', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.timeout',
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} revokes the invitation on its Origin alone',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    arrange: ({ organization }) => organization.revokeInvitation.mockResolvedValue(undefined),
    status: 204,
    check: (_response, { organization }) => {
      expect(organization.revokeInvitation).toHaveBeenCalledWith(MARC_INVITATION.id);
    },
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} refuses an id that is not a UUID',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: '/v1/invitations/marc',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} answers 401 without a credential',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} refuses another Origin',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    origin: 'https://evil.test',
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} answers 404 invitation.not-found when the caller left the organization',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    arrange: ({ organization }) =>
      organization.revokeInvitation.mockRejectedValue(
        organizationProblem(404, 'organization.not-found'),
      ),
    status: 404,
    code: 'invitation.not-found',
    check: (response) => {
      expect(response.body).toMatchObject({ title: 'Invitation introuvable.' });
    },
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} relays 409 invitation.answered with its status',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    arrange: ({ organization }) =>
      organization.revokeInvitation.mockRejectedValue(
        organizationProblem(409, 'invitation.answered', { status: 'accepted' }),
      ),
    status: 409,
    code: 'invitation.answered',
    check: (response) => {
      expect(response.body).toMatchObject({ details: { status: 'accepted' } });
    },
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} answers 429 beyond the quota',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 8 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'DELETE /v1/invitations/{invitationId} answers 503 when organization-service cannot answer',
    method: 'delete',
    path: '/v1/invitations/{invitationId}',
    url: INVITATION_URL,
    arrange: ({ organization }) =>
      organization.revokeInvitation.mockRejectedValue(
        identityUnavailable('unavailable', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.unavailable',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend answers the invitation with its ETag',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ organization }) =>
      organization.resendInvitation.mockResolvedValue({ ...MARC_INVITATION, version: 2 }),
    status: 200,
    check: (response) => {
      expect(response.headers.etag).toBe('"2"');
    },
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend refuses a body with members',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: { message: 'Bonjour' },
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend answers 401 without a credential',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    credential: 'none',
    body: {},
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend refuses a form body',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    headers: { 'Content-Type': 'text/plain' },
    body: '{}',
    status: 403,
    code: 'auth.csrf-rejected',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend relays 404 invitation.not-found',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ organization }) =>
      organization.resendInvitation.mockRejectedValue(
        organizationProblem(404, 'invitation.not-found'),
      ),
    status: 404,
    code: 'invitation.not-found',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend relays 409 invitation.revoked',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ organization }) =>
      organization.resendInvitation.mockRejectedValue(
        organizationProblem(409, 'invitation.revoked'),
      ),
    status: 409,
    code: 'invitation.revoked',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend answers 429 beyond the quota',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 8 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend answers 409 invitation.expired, which it does not declare, as 503',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ organization }) =>
      organization.resendInvitation.mockRejectedValue(
        organizationProblem(409, 'invitation.expired'),
      ),
    status: 503,
    code: 'upstream.failed',
  },
  {
    name: 'POST /v1/invitations relays 429 invitation.daily-limit-reached with its French title, the emails left and Retry-After',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: BATCH,
    arrange: ({ organization }) =>
      organization.inviteMembers.mockRejectedValue(
        organizationProblem(429, 'invitation.daily-limit-reached', {
          remaining: 1,
          nextAvailableAt: NEXT_AVAILABLE_AT,
        }),
      ),
    status: 429,
    code: 'invitation.daily-limit-reached',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Limite d’invitations atteinte pour aujourd’hui : réessayez plus tard.',
        status: 429,
        code: 'invitation.daily-limit-reached',
        details: { remaining: 1, nextAvailableAt: NEXT_AVAILABLE_AT },
      });
      expectRetryAfterUntil(response, NEXT_AVAILABLE_AT);
    },
  },
  {
    name: 'POST /v1/invitations answers 429 invitation.resend-throttled, which it does not declare, as 503',
    method: 'post',
    path: '/v1/invitations',
    url: '/v1/invitations',
    body: BATCH,
    arrange: ({ organization }) =>
      organization.inviteMembers.mockRejectedValue(
        organizationProblem(429, 'invitation.resend-throttled', {
          resendAvailableAt: RESEND_AVAILABLE_AT,
        }),
      ),
    status: 503,
    code: 'upstream.failed',
    check: (response) => {
      expect(response.headers['retry-after']).toBeUndefined();
    },
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend relays 429 invitation.resend-throttled with its French title and Retry-After',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ organization }) =>
      organization.resendInvitation.mockRejectedValue(
        organizationProblem(429, 'invitation.resend-throttled', {
          resendAvailableAt: RESEND_AVAILABLE_AT,
        }),
      ),
    status: 429,
    code: 'invitation.resend-throttled',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Cette invitation vient d’être renvoyée : réessayez dans une heure.',
        status: 429,
        code: 'invitation.resend-throttled',
        details: { resendAvailableAt: RESEND_AVAILABLE_AT },
      });
      expectRetryAfterUntil(response, RESEND_AVAILABLE_AT);
    },
  },
  {
    name: 'POST /v1/invitations/{invitationId}/resend relays 429 invitation.daily-limit-reached with its French title, no email left and Retry-After',
    method: 'post',
    path: '/v1/invitations/{invitationId}/resend',
    url: `${INVITATION_URL}/resend`,
    body: {},
    arrange: ({ organization }) =>
      organization.resendInvitation.mockRejectedValue(
        organizationProblem(429, 'invitation.daily-limit-reached', {
          remaining: 0,
          nextAvailableAt: NEXT_AVAILABLE_AT,
        }),
      ),
    status: 429,
    code: 'invitation.daily-limit-reached',
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Limite d’invitations atteinte pour aujourd’hui : réessayez plus tard.',
        status: 429,
        code: 'invitation.daily-limit-reached',
        details: { remaining: 0, nextAvailableAt: NEXT_AVAILABLE_AT },
      });
      expectRetryAfterUntil(response, NEXT_AVAILABLE_AT);
    },
  },
];

describe('routes of /v1/invitations', () => {
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

  it('exercises every status each invitation route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('refuses a personal API token on every invitation route', async () => {
    for (const routeCase of CASES.filter((candidate) => candidate.status === 200)) {
      await runRouteCase(application, identity, {
        ...routeCase,
        name: 'token',
        credential: 'members-token',
        origin: null,
        arrange: undefined,
        check: undefined,
        status: 403,
        code: 'auth.api-token-not-accepted',
      });
    }
  });

  it('never writes an invited address into the logs', async () => {
    application.organization.inviteMembers.mockResolvedValue({ invitations: [] });
    application.logLines.length = 0;

    await runRouteCase(application, identity, {
      name: 'batch',
      method: 'post',
      path: '/v1/invitations',
      url: '/v1/invitations',
      body: BATCH,
      status: 200,
    });

    expect(application.logLines.join('\n')).not.toContain('marc.roux@ateliernord.fr');
  });
});
