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

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import {
  ATELIER_NORD,
  INES,
  LUMEN_INVITATION,
  MARC_INVITATION,
  MY_ATELIER_NORD,
} from '../../tests/support/fake-organization.js';
import {
  GATEWAY_ISSUER,
  generateSigningKeys,
  type SigningKeys,
} from '../../tests/support/test-environment.js';
import { ORGANIZATION_SERVICE, OrganizationServiceClient } from './organization-service.client.js';

/**
 * A call the fake organization-service received.
 */
interface RecordedCall {
  // #region Properties
  /** HTTP method. */
  readonly method: string;

  /** Absolute URL called. */
  readonly url: string;

  /** Parsed JSON body, `undefined` without one. */
  readonly body: unknown;

  /** `If-Match` of the call. */
  readonly ifMatch: string | null;

  /** The internal token, verified as organization-service verifies it. */
  readonly principal: InternalPrincipal;
  // #endregion
}

/**
 * Constant BASE_URL
 *
 * @description
 * `ORGANIZATION_SERVICE_URL` of the tests.
 *
 * @type {string}
 */
const BASE_URL: string = 'http://organization-service.test:3011';

/**
 * Constant OWNER
 *
 * @description
 * Organization context of Camille, owner of Atelier Nord.
 *
 * @type {OrganizationContext}
 */
const OWNER: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: ['members:read'],
};

/**
 * Function json
 *
 * @description
 * A JSON response of the fake organization-service.
 *
 * @param {number} status - HTTP status.
 * @param {unknown} body - JSON body.
 * @returns {Response} The response.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

describe('OrganizationServiceClient', () => {
  let signer: InternalTokenSigner;
  let verifier: InternalTokenVerifier;
  let calls: RecordedCall[];
  let answer: Mock<() => Response>;
  let client: OrganizationServiceClient;

  beforeAll(async () => {
    const keys: SigningKeys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: ORGANIZATION_SERVICE,
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
      calls.push({
        method: init?.method ?? 'GET',
        url: input instanceof Request ? input.url : input.toString(),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        ifMatch: headers.get('If-Match'),
        principal: await verifier.verify(
          (headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
        ),
      });
      return answer();
    };
    client = new OrganizationServiceClient(
      new InternalHttpClient({
        service: ORGANIZATION_SERVICE,
        baseUrl: BASE_URL,
        signer,
        fetch: fetchImplementation,
      }),
    );
  });

  /**
   * Runs a call in the organization context of Camille.
   *
   * @param call - The call.
   * @returns What it resolved with.
   */
  function asOwner<TResult>(call: () => Promise<TResult>): Promise<TResult> {
    return runWithOrganizationContext(OWNER, call);
  }

  it('reads the organization of the context, with an internal token for organization-service carrying it', async () => {
    answer.mockReturnValue(json(200, { ...ATELIER_NORD, internalNote: 'dropped' }));

    await expect(asOwner(() => client.getOrganization())).resolves.toEqual(ATELIER_NORD);
    expect(calls[0]).toMatchObject({
      method: 'GET',
      url: `${BASE_URL}/internal/v1/organization`,
      principal: {
        issuer: GATEWAY_ISSUER,
        audience: ORGANIZATION_SERVICE,
        actor: { type: 'user', id: CAMILLE.id },
        organizationId: ATELIER_NORD_ID,
        role: 'owner',
        scopes: ['members:read'],
      },
    });
  });

  it('validates the name lookup and signs the caller organization', async () => {
    answer.mockReturnValue(json(200, { items: [{ userId: CAMILLE.id, name: 'Camille' }] }));

    await expect(asOwner(() => client.lookupMemberNames([CAMILLE.id]))).resolves.toEqual({
      items: [{ userId: CAMILLE.id, name: 'Camille' }],
    });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `${BASE_URL}/internal/v1/member-names/lookup`,
      body: { userIds: [CAMILLE.id] },
      principal: { actor: { type: 'user', id: CAMILLE.id }, organizationId: ATELIER_NORD_ID },
    });
    await expect(asOwner(() => client.lookupMemberNames([]))).rejects.toThrow(
      'outside the internal contract',
    );
    expect(calls).toHaveLength(1);
  });

  it('creates an organization, without retrying a 503', async () => {
    answer.mockReturnValue(json(503, { type: 'about:blank', title: 'x', status: 503, code: 'x' }));

    await expect(
      asOwner(() =>
        client.createOrganization({
          name: 'Atelier Nord',
          teamSize: '6-20',
          primaryUse: 'other',
          inviteEmails: [],
        }),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.unavailable' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `${BASE_URL}/internal/v1/organizations`,
    });
  });

  it('answers the creation, checked against the contract', async () => {
    answer.mockReturnValue(json(201, { organization: ATELIER_NORD, invitations: [] }));

    await expect(
      asOwner(() =>
        client.createOrganization({
          name: 'Atelier Nord',
          teamSize: '6-20',
          primaryUse: 'other',
          inviteEmails: [],
        }),
      ),
    ).resolves.toEqual({ organization: ATELIER_NORD, invitations: [] });
  });

  it('lists the organizations of the user with the page in the query, retried once after a 503', async () => {
    answer
      .mockReturnValueOnce(new Response(null, { status: 503 }))
      .mockReturnValue(json(200, { items: [MY_ATELIER_NORD], nextCursor: null }));

    await expect(
      asOwner(() => client.listMyOrganizations({ cursor: 'next', limit: 10 })),
    ).resolves.toEqual({ items: [MY_ATELIER_NORD], nextCursor: null });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toBe(`${BASE_URL}/internal/v1/organizations?cursor=next&limit=10`);
  });

  it('relays If-Match on the change of the organization', async () => {
    answer.mockReturnValue(json(200, ATELIER_NORD));

    await asOwner(() => client.updateOrganization({ description: null }, '"3"'));

    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      url: `${BASE_URL}/internal/v1/organization`,
      body: { description: null },
      ifMatch: '"3"',
    });
  });

  it('lists the members with the roles comma-separated', async () => {
    answer.mockReturnValue(
      json(200, {
        items: [INES],
        nextCursor: null,
        total: 1,
        counts: { owner: 1, admin: 1, member: 0, guest: 0 },
      }),
    );

    await asOwner(() =>
      client.listMembers({ limit: 20, search: 'inès', role: ['owner', 'admin'] }),
    );

    expect(calls[0]?.url).toBe(
      `${BASE_URL}/internal/v1/members?limit=20&search=in%C3%A8s&role=owner%2Cadmin`,
    );
  });

  it('reads, changes and removes a member', async () => {
    answer
      .mockReturnValueOnce(json(200, INES))
      .mockReturnValueOnce(json(200, { ...INES, role: 'member' }))
      .mockReturnValueOnce(new Response(null, { status: 204 }));

    await asOwner(() => client.getMember(INES.id));
    await asOwner(() => client.changeMemberRole(INES.id, { role: 'member' }, undefined));
    await asOwner(() => client.removeMember(INES.id));

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${BASE_URL}/internal/v1/members/${INES.id}`,
      `PATCH ${BASE_URL}/internal/v1/members/${INES.id}`,
      `DELETE ${BASE_URL}/internal/v1/members/${INES.id}`,
    ]);
    expect(calls[1]).toMatchObject({ body: { role: 'member' }, ifMatch: null });
  });

  it('invites, lists, revokes and resends invitations of the organization', async () => {
    answer
      .mockReturnValueOnce(json(200, { invitations: [] }))
      .mockReturnValueOnce(json(200, { items: [MARC_INVITATION], nextCursor: null, total: 1 }))
      .mockReturnValueOnce(new Response(null, { status: 204 }))
      .mockReturnValueOnce(json(200, MARC_INVITATION));

    await asOwner(() => client.inviteMembers({ emails: [MARC_INVITATION.email], role: 'member' }));
    await asOwner(() => client.listInvitations({ limit: 50 }));
    await asOwner(() => client.revokeInvitation(MARC_INVITATION.id));
    await asOwner(() => client.resendInvitation(MARC_INVITATION.id));

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${BASE_URL}/internal/v1/invitations`,
      `GET ${BASE_URL}/internal/v1/invitations?limit=50`,
      `DELETE ${BASE_URL}/internal/v1/invitations/${MARC_INVITATION.id}`,
      `POST ${BASE_URL}/internal/v1/invitations/${MARC_INVITATION.id}/resend`,
    ]);
    expect(calls[3]?.body).toEqual({});
  });

  it('lists, accepts and refuses the invitations of the user', async () => {
    answer
      .mockReturnValueOnce(json(200, { items: [LUMEN_INVITATION], nextCursor: null }))
      .mockReturnValueOnce(json(200, MY_ATELIER_NORD))
      .mockReturnValueOnce(new Response(null, { status: 204 }));

    await asOwner(() => client.listReceivedInvitations(CAMILLE.id, { limit: 50 }));
    await asOwner(() => client.acceptInvitation(CAMILLE.id, LUMEN_INVITATION.id));
    await asOwner(() => client.refuseInvitation(CAMILLE.id, LUMEN_INVITATION.id));

    const prefix = `${BASE_URL}/internal/v1/users/${CAMILLE.id}/invitations`;
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${prefix}?limit=50`,
      `POST ${prefix}/${LUMEN_INVITATION.id}/accept`,
      `POST ${prefix}/${LUMEN_INVITATION.id}/refuse`,
    ]);
    expect(calls[1]?.body).toEqual({});
  });

  it('relays a client error with its code and details, naming organization-service', async () => {
    answer.mockReturnValue(
      json(409, {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'organization.slug-taken',
        details: { slug: 'atelier-nord' },
      }),
    );

    const failure: unknown = await asOwner(() =>
      client.updateOrganization({ slug: 'x' }, undefined),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProblemException);
    expect((failure as ProblemException).problem).toMatchObject({
      status: 409,
      code: 'organization.slug-taken',
      details: { slug: 'atelier-nord', service: ORGANIZATION_SERVICE },
    });
  });

  it('answers an answer outside the contract as 503 upstream.failed, naming members only', async () => {
    answer.mockReturnValue(json(200, { ...INES, email: 'not-an-address' }));

    const failure: unknown = await asOwner(() => client.getMember(INES.id)).catch(
      (error: unknown) => error,
    );

    expect((failure as ProblemException).problem).toMatchObject({
      status: 503,
      code: 'upstream.failed',
      details: { service: ORGANIZATION_SERVICE },
    });
    expect(JSON.stringify((failure as ProblemException).problem)).not.toContain('not-an-address');
  });

  it('answers a success status the operation does not declare as 503 upstream.failed', async () => {
    answer.mockReturnValue(json(200, {}));

    await expect(asOwner(() => client.removeMember(INES.id))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('never retries the removal of a member, whose repeat would answer 404', async () => {
    answer.mockReturnValue(new Response(null, { status: 503 }));

    await expect(asOwner(() => client.removeMember(INES.id))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.unavailable' },
    });
    expect(calls).toHaveLength(1);
  });

  it('retries the revocation of an invitation once after a 503, as its repeat answers 204', async () => {
    answer
      .mockReturnValueOnce(new Response(null, { status: 503 }))
      .mockReturnValue(new Response(null, { status: 204 }));

    await asOwner(() => client.revokeInvitation(MARC_INVITATION.id));

    expect(calls).toHaveLength(2);
  });
});
