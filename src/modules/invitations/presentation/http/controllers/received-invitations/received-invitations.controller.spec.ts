import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  CAMILLE,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { LUMEN_INVITATION } from '../../../../../../../tests/support/fake-organization.js';
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
 * @param {400 | 403 | 404 | 409} status - Status organization-service answered.
 * @param {string} code - Code of its problem.
 * @param {Readonly<Record<string, unknown>>} details - Details of its problem.
 * @returns {ReturnType<typeof identityProblem>} The problem.
 */
function organizationProblem(
  status: 400 | 403 | 404 | 409,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): ReturnType<typeof identityProblem> {
  return identityProblem(status, code, details, 'organization-service');
}

/**
 * Constant JOINED
 *
 * @description
 * The organization the acceptance joins, as organization-service answers it.
 *
 * @type {{ id: string; name: string; slug: string; role: 'member'; memberCount: number; plan: string; joinedAt: string }}
 */
const JOINED: {
  id: string;
  name: string;
  slug: string;
  role: 'member';
  memberCount: number;
  plan: string;
  joinedAt: string;
} = {
  id: LUMEN_INVITATION.organization.id,
  name: 'Coopérative Lumen',
  slug: 'lumen',
  role: 'member',
  memberCount: 42,
  plan: 'free',
  joinedAt: '2026-11-08T10:30:00Z',
};

/**
 * Function answerCases
 *
 * @description
 * The success and every declared error of the acceptance or the refusal.
 *
 * @param {'accept' | 'refuse'} answer - Which answer.
 * @returns {RouteCase[]} The cases.
 */
function answerCases(answer: 'accept' | 'refuse'): RouteCase[] {
  const path = `/v1/me/invitations/{invitationId}/${answer}`;
  const url = `/v1/me/invitations/${LUMEN_INVITATION.id}/${answer}`;
  const method = answer === 'accept' ? 'acceptInvitation' : 'refuseInvitation';
  return [
    {
      name: `POST ${path} answers the invitation of the user of the session`,
      method: 'post',
      path,
      url,
      credential: 'session-without-organization',
      body: {},
      arrange: ({ organization }) => {
        if (answer === 'accept') {
          organization.acceptInvitation.mockResolvedValue(JOINED);
        } else {
          organization.refuseInvitation.mockResolvedValue(undefined);
        }
      },
      status: answer === 'accept' ? 200 : 204,
      check: (response, { organization }) => {
        expect(organization[method]).toHaveBeenCalledWith(CAMILLE.id, LUMEN_INVITATION.id);
        if (answer === 'accept') {
          expect(response.body).toEqual(JOINED);
        }
      },
    },
    {
      name: `POST ${path} refuses a body with members`,
      method: 'post',
      path,
      url,
      body: { reason: 'no' },
      status: 400,
      code: 'request.invalid',
    },
    {
      name: `POST ${path} answers 401 without a credential`,
      method: 'post',
      path,
      url,
      credential: 'none',
      body: {},
      status: 401,
      code: 'auth.session-required',
    },
    {
      name: `POST ${path} relays 403 invitation.email-mismatch`,
      method: 'post',
      path,
      url,
      body: {},
      arrange: ({ organization }) =>
        organization[method].mockRejectedValue(
          organizationProblem(403, 'invitation.email-mismatch'),
        ),
      status: 403,
      code: 'invitation.email-mismatch',
      check: (response) => {
        expect(response.body).toMatchObject({
          title: 'Cette invitation a été envoyée à une autre adresse e-mail.',
        });
      },
    },
    {
      name: `POST ${path} relays 404 invitation.not-found`,
      method: 'post',
      path,
      url,
      body: {},
      arrange: ({ organization }) =>
        organization[method].mockRejectedValue(organizationProblem(404, 'invitation.not-found')),
      status: 404,
      code: 'invitation.not-found',
    },
    {
      name: `POST ${path} relays 409 invitation.expired with its expiry`,
      method: 'post',
      path,
      url,
      body: {},
      arrange: ({ organization }) =>
        organization[method].mockRejectedValue(
          organizationProblem(409, 'invitation.expired', { expiresAt: '2026-11-02T15:00:00Z' }),
        ),
      status: 409,
      code: 'invitation.expired',
      check: (response) => {
        expect(response.body).toMatchObject({
          title:
            'Cette invitation a expiré : demandez-en une nouvelle à un administrateur de l’organisation.',
          details: { expiresAt: '2026-11-02T15:00:00Z' },
        });
      },
    },
    {
      name: `POST ${path} answers 429 beyond the quota`,
      method: 'post',
      path,
      url,
      body: {},
      arrange: ({ counter }) =>
        counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 2 }),
      status: 429,
      code: 'rate-limit.exceeded',
    },
    {
      name: `POST ${path} answers a user that is not the actor as 503, a defect`,
      method: 'post',
      path,
      url,
      body: {},
      arrange: ({ organization }) =>
        organization[method].mockRejectedValue(organizationProblem(404, 'user.not-found')),
      status: 503,
      code: 'upstream.failed',
    },
  ];
}

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each route of `/v1/me/invitations`.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  {
    name: 'GET /v1/me/invitations answers the invitations addressed to the user of the session',
    method: 'get',
    path: '/v1/me/invitations',
    url: '/v1/me/invitations',
    credential: 'session-without-organization',
    arrange: ({ organization }) =>
      organization.listReceivedInvitations.mockResolvedValue({
        items: [LUMEN_INVITATION],
        nextCursor: null,
      }),
    status: 200,
    check: (response, { organization }) => {
      expect(response.body).toEqual({ items: [LUMEN_INVITATION], nextCursor: null });
      expect(organization.listReceivedInvitations).toHaveBeenCalledWith(CAMILLE.id, { limit: 50 });
    },
  },
  {
    name: 'GET /v1/me/invitations refuses an unknown query parameter',
    method: 'get',
    path: '/v1/me/invitations',
    url: '/v1/me/invitations?userId=someone-else',
    status: 400,
    code: 'request.invalid',
  },
  {
    name: 'GET /v1/me/invitations answers 401 without a credential',
    method: 'get',
    path: '/v1/me/invitations',
    url: '/v1/me/invitations',
    credential: 'none',
    status: 401,
    code: 'auth.session-required',
  },
  {
    name: 'GET /v1/me/invitations refuses a personal API token',
    method: 'get',
    path: '/v1/me/invitations',
    url: '/v1/me/invitations',
    credential: 'members-token',
    status: 403,
    code: 'auth.api-token-not-accepted',
  },
  {
    name: 'GET /v1/me/invitations answers 429 beyond the quota',
    method: 'get',
    path: '/v1/me/invitations',
    url: '/v1/me/invitations',
    arrange: ({ counter }) =>
      counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 2 }),
    status: 429,
    code: 'rate-limit.exceeded',
  },
  {
    name: 'GET /v1/me/invitations answers 503 when organization-service cannot answer',
    method: 'get',
    path: '/v1/me/invitations',
    url: '/v1/me/invitations',
    arrange: ({ organization }) =>
      organization.listReceivedInvitations.mockRejectedValue(
        identityUnavailable('timeout', 'organization-service'),
      ),
    status: 503,
    code: 'upstream.timeout',
  },
  ...answerCases('accept'),
  ...answerCases('refuse'),
];

describe('routes of /v1/me/invitations', () => {
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

  it('exercises every status each route of the invitee declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('refuses a cross-site acceptance before the introspection', async () => {
    await runRouteCase(application, identity, {
      name: 'cross-site',
      method: 'post',
      path: '/v1/me/invitations/{invitationId}/accept',
      url: `/v1/me/invitations/${LUMEN_INVITATION.id}/accept`,
      origin: 'https://evil.test',
      body: {},
      status: 403,
      code: 'auth.csrf-rejected',
    });

    expect(identity.introspect).not.toHaveBeenCalled();
  });
});
