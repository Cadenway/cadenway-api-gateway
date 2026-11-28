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
import { RetryableProblemException } from '../problems/upstream-answer.js';
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

  /** Idempotency key supplied for a reservation. */
  readonly idempotencyKey: string | null;

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

  it('uses the current actor and selected organization for the private automation recipient proof', async () => {
    answer.mockReturnValue(
      Response.json(
        { eligible: true },
        {
          headers: { 'Cache-Control': 'private, no-store' },
        },
      ),
    );
    const userId = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e03';
    await expect(
      runWithOrganizationContext(OWNER, () => client.checkAutomationRecipient(userId)),
    ).resolves.toBe(true);
    expect(calls).toMatchObject([
      {
        method: 'POST',
        url: `${BASE_URL}/internal/v1/automation-recipients/check`,
        body: { userId },
        principal: {
          actor: OWNER.actor,
          organizationId: OWNER.organizationId,
          audience: ORGANIZATION_SERVICE,
        },
      },
    ]);
  });

  it('refuses an automation recipient decision without its private cache policy', async () => {
    answer.mockReturnValue(Response.json({ eligible: true }));
    await expect(
      runWithOrganizationContext(OWNER, () =>
        client.checkAutomationRecipient('019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e03'),
      ),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed', details: { service: ORGANIZATION_SERVICE } },
    });
  });

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
        idempotencyKey: headers.get('Idempotency-Key'),
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

  describe('logo ownership', () => {
    const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
    const reservation = { uploadId, expiresAt: '2026-11-20T20:00:00.000Z' };
    const logoPath = '/internal/v1/organization/logo';

    it('preserves the logo reference on the authorized organization read', async () => {
      answer.mockReturnValueOnce(json(200, { ...ATELIER_NORD, logoId: uploadId }));
      await expect(asOwner(() => client.getOrganization())).resolves.toMatchObject({
        logoId: uploadId,
      });
    });

    it('relays the logo declaration, verified organization and replay key', async () => {
      const upload = { contentType: 'image/svg+xml', sizeBytes: 43_024 } as const;
      const response = json(201, reservation);
      response.headers.set('Location', `${logoPath}/uploads/${uploadId}`);
      answer.mockReturnValueOnce(response);

      await expect(
        asOwner(() => client.reserveOrganizationLogoUpload(upload, 'logo-replay')),
      ).resolves.toStrictEqual(reservation);
      expect(calls[0]).toMatchObject({
        method: 'POST',
        url: `${BASE_URL}${logoPath}/uploads`,
        body: upload,
        idempotencyKey: 'logo-replay',
        principal: { actor: OWNER.actor, organizationId: ATELIER_NORD_ID, role: 'owner' },
      });
    });

    it('sends one reservation even when it carries a replay key and Organization returns 503', async () => {
      answer.mockReturnValueOnce(new Response(null, { status: 503 }));

      await expect(
        asOwner(() =>
          client.reserveOrganizationLogoUpload(
            { contentType: 'image/png', sizeBytes: 500 },
            'logo-replay',
          ),
        ),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.unavailable' } });
      expect(calls).toHaveLength(1);
    });

    it('relays the unsupported declaration so Organization returns its typed refusal', async () => {
      const declaration = { contentType: 'image/tiff', sizeBytes: 500 };
      answer.mockReturnValueOnce(
        json(422, {
          title: 'Unsupported logo source',
          status: 422,
          code: 'media.unsupported-type',
        }),
      );

      await expect(
        asOwner(() => client.reserveOrganizationLogoUpload(declaration, undefined)),
      ).rejects.toMatchObject({ problem: { status: 422, code: 'media.unsupported-type' } });
      expect(calls[0]?.body).toStrictEqual(declaration);
    });

    it('validates the state of the requested logo reservation', async () => {
      answer
        .mockReturnValueOnce(json(200, { ...reservation, state: 'committed' }))
        .mockReturnValueOnce(json(200, { ...reservation, state: 'pending' }));

      await expect(
        asOwner(() => client.getOrganizationLogoUploadState(uploadId)),
      ).resolves.toStrictEqual({
        ...reservation,
        state: 'committed',
      });
      await expect(
        asOwner(() =>
          client.getOrganizationLogoUploadState('019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b02'),
        ),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
      expect(calls[0]?.url).toBe(`${BASE_URL}${logoPath}/uploads/${uploadId}`);
    });

    it('relays a strong commit ETag and rejects a deletion without an ETag', async () => {
      answer
        .mockReturnValueOnce(new Response(null, { status: 204, headers: { ETag: '"12"' } }))
        .mockReturnValueOnce(new Response(null, { status: 204 }));

      await expect(
        asOwner(() => client.setOrganizationLogo(uploadId, '"11"')),
      ).resolves.toStrictEqual({
        etag: '"12"',
      });
      await expect(asOwner(() => client.deleteOrganizationLogo(undefined))).rejects.toMatchObject({
        problem: { status: 503, code: 'upstream.failed' },
      });
      expect(calls).toMatchObject([
        { method: 'PUT', url: `${BASE_URL}${logoPath}`, body: { uploadId }, ifMatch: '"11"' },
        { method: 'DELETE', url: `${BASE_URL}${logoPath}`, body: undefined, ifMatch: null },
      ]);
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

  it('sends member filters as a JSON QUERY in the verified organization', async () => {
    answer.mockReturnValue(
      json(200, {
        items: [INES],
        nextCursor: null,
        total: 1,
        counts: { owner: 1, admin: 1, member: 0, guest: 0 },
      }),
    );
    const body = { limit: 20, search: 'inès', role: ['owner', 'admin'] as ('owner' | 'admin')[] };
    await asOwner(() => client.queryListMembers(body));
    expect(calls[0]).toMatchObject({
      method: 'QUERY',
      url: `${BASE_URL}/internal/v1/members`,
      body,
      principal: { actor: OWNER.actor, organizationId: OWNER.organizationId },
    });
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

  it('sends a keyed batch to the invitation batches with its Idempotency-Key unchanged', async () => {
    const result = {
      invitations: [
        { email: MARC_INVITATION.email, outcome: 'invited', invitationId: MARC_INVITATION.id },
      ],
    };
    answer.mockReturnValue(json(200, result));

    await expect(
      asOwner(() =>
        client.inviteMembersKeyed({ emails: [MARC_INVITATION.email], role: 'member' }, 'batch-7'),
      ),
    ).resolves.toEqual(result);

    expect(calls).toMatchObject([
      {
        method: 'POST',
        url: `${BASE_URL}/internal/v1/invitation-batches`,
        body: { emails: [MARC_INVITATION.email], role: 'member' },
        idempotencyKey: 'batch-7',
        principal: { actor: OWNER.actor, organizationId: OWNER.organizationId },
      },
    ]);
  });

  it('never sends an Idempotency-Key with a batch to the plain invitation', async () => {
    answer.mockReturnValue(json(200, { invitations: [] }));

    await asOwner(() => client.inviteMembers({ emails: [MARC_INVITATION.email], role: 'member' }));

    expect(calls).toMatchObject([
      { url: `${BASE_URL}/internal/v1/invitations`, idempotencyKey: null },
    ]);
  });

  it.each([
    [
      'a problem of another code',
      json(404, {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'request.not-found',
      }),
    ],
    ['a body that is not a problem', new Response('Cannot POST', { status: 404 })],
  ])(
    'answers a 404 with %s on a keyed batch as 503 upstream.unavailable with a retry delay, without calling the plain invitation',
    async (_name, notFound) => {
      answer.mockReturnValue(notFound);

      const failure: unknown = await asOwner(() =>
        client.inviteMembersKeyed({ emails: [MARC_INVITATION.email], role: 'member' }, 'batch-7'),
      ).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RetryableProblemException);
      expect((failure as RetryableProblemException).retryAfterSeconds).toBe(10);
      expect((failure as RetryableProblemException).problem).toMatchObject({
        status: 503,
        code: 'upstream.unavailable',
        details: { service: ORGANIZATION_SERVICE },
      });
      expect(calls.map((call) => call.url)).toEqual([`${BASE_URL}/internal/v1/invitation-batches`]);
    },
  );

  it('relays 404 organization.not-found of a keyed batch as it is', async () => {
    answer.mockReturnValue(
      json(404, {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'organization.not-found',
      }),
    );

    const failure: unknown = await asOwner(() =>
      client.inviteMembersKeyed({ emails: [MARC_INVITATION.email], role: 'member' }, 'batch-7'),
    ).catch((error: unknown) => error);

    expect(failure).not.toBeInstanceOf(RetryableProblemException);
    expect((failure as ProblemException).problem).toMatchObject({
      status: 404,
      code: 'organization.not-found',
    });
  });

  it.each([
    [409, 'idempotency.request-in-progress'],
    [422, 'idempotency.key-reused'],
  ])('relays %i %s of a keyed batch with its code', async (status, code) => {
    answer.mockReturnValue(json(status, { type: 'about:blank', title: 'x', status, code }));

    await expect(
      asOwner(() =>
        client.inviteMembersKeyed({ emails: [MARC_INVITATION.email], role: 'member' }, 'batch-7'),
      ),
    ).rejects.toMatchObject({ problem: { status, code } });
  });

  it.each([
    [
      'keyed batch',
      (): Promise<unknown> =>
        client.inviteMembersKeyed({ emails: [MARC_INVITATION.email], role: 'member' }, 'batch-7'),
    ],
    [
      'plain invitation',
      (): Promise<unknown> =>
        client.inviteMembers({ emails: [MARC_INVITATION.email], role: 'member' }),
    ],
  ])(
    'relays 429 invitation.keyed-batch-limit-reached of a %s with its details, never retried nor counted by the circuit breaker',
    async (_name, invite) => {
      const nextAvailableAt = '2026-11-08T09:15:00Z';
      answer.mockImplementation(() =>
        json(429, {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          code: 'invitation.keyed-batch-limit-reached',
          details: { nextAvailableAt },
        }),
      );

      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const failure: unknown = await asOwner(invite).catch((error: unknown) => error);

        expect(failure).not.toBeInstanceOf(RetryableProblemException);
        expect((failure as ProblemException).problem).toMatchObject({
          status: 429,
          code: 'invitation.keyed-batch-limit-reached',
          details: { nextAvailableAt, service: ORGANIZATION_SERVICE },
        });
      }
      // One call per request: a 429 is never retried. Six in a row, past the five consecutive
      // failures that open the breaker, and the next call still reaches organization-service.
      expect(calls).toHaveLength(6);
      answer.mockImplementation(() => json(200, { invitations: [] }));

      await asOwner(invite);

      expect(calls).toHaveLength(7);
    },
  );

  it('retries a keyed batch once after a 503, as its key makes the repeat replay', async () => {
    answer
      .mockReturnValueOnce(new Response(null, { status: 503 }))
      .mockReturnValue(json(200, { invitations: [] }));

    await asOwner(() =>
      client.inviteMembersKeyed({ emails: [MARC_INVITATION.email], role: 'member' }, 'batch-7'),
    );

    expect(calls.map((call) => call.idempotencyKey)).toEqual(['batch-7', 'batch-7']);
  });

  it('reads an invitation of the organization in any state', async () => {
    const accepted = {
      ...MARC_INVITATION,
      status: 'accepted',
      answeredAt: '2026-11-07T09:30:00Z',
      revokedAt: null,
    };
    answer.mockReturnValue(json(200, accepted));

    await expect(asOwner(() => client.getInvitation(MARC_INVITATION.id))).resolves.toEqual(
      accepted,
    );
    expect(calls[0]).toMatchObject({
      method: 'GET',
      url: `${BASE_URL}/internal/v1/invitations/${MARC_INVITATION.id}`,
    });
  });

  it('answers an invitation without its lifecycle dates as 503 upstream.failed', async () => {
    answer.mockReturnValue(json(200, MARC_INVITATION));

    await expect(asOwner(() => client.getInvitation(MARC_INVITATION.id))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
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
