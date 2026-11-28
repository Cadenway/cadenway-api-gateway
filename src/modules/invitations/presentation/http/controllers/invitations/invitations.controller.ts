import type {
  Invitation,
  InvitationState,
  InvitationBatchResult,
  InvitationPage,
} from '@cadenway/contracts/types/public/members';
import {
  GetInvitationParams,
  InviteMembersBody,
  InviteMembersHeader,
  ListInvitationsQueryParams,
  ResendInvitationBody,
  RevokeInvitationParams,
} from '@cadenway/contracts/validators/public/members';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import {
  relayUpstream,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { InviteMembers } from '../../../../application/use-cases/commands/invitations/invite-members/invite-members.use-case.js';
import { ResendInvitation } from '../../../../application/use-cases/commands/invitations/resend-invitation/resend-invitation.use-case.js';
import { RevokeInvitation } from '../../../../application/use-cases/commands/invitations/revoke-invitation/revoke-invitation.use-case.js';
import { GetInvitation } from '../../../../application/use-cases/queries/invitations/get-invitation/get-invitation.use-case.js';
import { ListInvitations } from '../../../../application/use-cases/queries/invitations/list-invitations/list-invitations.use-case.js';
import {
  toInvitation,
  toInvitationBatchResult,
  toInvitationPage,
  toInvitationState,
} from '../../mappers/invitations/invitation.mapper.js';

/**
 * Constant ORGANIZATION_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/invitations` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const ORGANIZATION_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['organization.not-found'],
};

/**
 * Constant INVITE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `POST /v1/invitations` answers as they are: those of
 * `GET /v1/invitations`, and `429 invitation.daily-limit-reached` when the batch needs more
 * invitation emails than the organization has left of its 100 in any 24 hours, with
 * `details.remaining`, `details.nextAvailableAt` and `Retry-After`.
 *
 * @type {AcceptedProblems}
 */
const INVITE_PROBLEMS: AcceptedProblems = {
  ...ORGANIZATION_PROBLEMS,
  429: ['invitation.daily-limit-reached'],
};

/**
 * Constant KEYED_INVITE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `POST /v1/invitations` with an `Idempotency-Key`
 * answers as they are: those of `INVITE_PROBLEMS`, and the refusals of the key,
 * `409 idempotency.request-in-progress` (an equivalent request with the key is still running) and
 * `422 idempotency.key-reused` (the key went with another body). The contract gives them no
 * French title: they keep the reason phrase of their status, as on the other keyed routes.
 *
 * @type {AcceptedProblems}
 */
const KEYED_INVITE_PROBLEMS: AcceptedProblems = {
  ...INVITE_PROBLEMS,
  409: ['idempotency.request-in-progress'],
  422: ['idempotency.key-reused'],
};

/**
 * Constant GET_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/invitations/{invitationId}` answers as they
 * are: `403 organization.role-forbidden` for a member or a guest, and `404 invitation.not-found`
 * for an invitation of another organization or none.
 *
 * @type {AcceptedProblems}
 */
const GET_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['invitation.not-found'],
};

/**
 * Constant REVOKE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `DELETE /v1/invitations/{invitationId}` answers as
 * they are.
 *
 * @type {AcceptedProblems}
 */
const REVOKE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['invitation.not-found'],
  409: ['invitation.answered'],
};

/**
 * Constant RESEND_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `POST /v1/invitations/{invitationId}/resend`
 * answers as they are, the two limits of the invitation emails included:
 * `429 invitation.resend-throttled` (`details.resendAvailableAt`) and
 * `429 invitation.daily-limit-reached` (`details.remaining`, `details.nextAvailableAt`), each with
 * `Retry-After`.
 *
 * @type {AcceptedProblems}
 */
const RESEND_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['invitation.not-found'],
  409: ['invitation.revoked', 'invitation.answered'],
  429: ['invitation.resend-throttled', 'invitation.daily-limit-reached'],
};

/**
 * Constant INVITATION_ALIASES
 *
 * @description
 * On a route about one invitation, the caller who no longer belongs to the organization
 * (`404 organization.not-found` of organization-service) gets the `404 invitation.not-found` the
 * public operation declares.
 *
 * @type {Readonly<Record<string, string>>}
 */
const INVITATION_ALIASES: Readonly<Record<string, string>> = {
  'organization.not-found': 'invitation.not-found',
};

/**
 * Constant LIST_QUERY
 *
 * @description
 * The query of `GET /v1/invitations` as the contract validates it; its generated validator reads
 * `limit` from its text.
 *
 * @type {z.ZodType<z.output<typeof ListInvitationsQueryParams>>}
 */
const LIST_QUERY = ListInvitationsQueryParams;

/**
 * Constant EMPTY_BODY
 *
 * @description
 * Validator of the body of the resend: an empty object, with no other member
 * (`additionalProperties: false` in the contract, which the generated validator does not enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const EMPTY_BODY: z.ZodType<Record<string, never>> = ResendInvitationBody.strict();

/**
 * Class InvitationsController
 *
 * @description
 * The invitation routes of `openapi/public/members.yaml` on the current organization: invite a
 * batch of addresses, list the pending invitations, read one in any state, revoke one and send one
 * again. Session only:
 * `CredentialGuard` answers a personal API token `403 auth.api-token-not-accepted` and a session
 * without a current organization `403 organization.not-selected`, before any call;
 * `RateLimitGuard` counts the session. organization-service decides who may (owner and admins)
 * and answers an invitation of another organization `404`.
 */
@Controller('v1/invitations')
@UseGuards(CredentialGuard, RateLimitGuard)
export class InvitationsController {
  // #region Properties
  /**
   * Property inviting
   *
   * @description
   * Invites a batch of addresses.
   *
   * @type {InviteMembers}
   * @readonly
   */
  private readonly inviting: InviteMembers;

  /**
   * Property listing
   *
   * @description
   * Lists the pending invitations.
   *
   * @type {ListInvitations}
   * @readonly
   */
  private readonly listing: ListInvitations;

  /**
   * Property reading
   *
   * @description
   * Reads one invitation in any state.
   *
   * @type {GetInvitation}
   * @readonly
   */
  private readonly reading: GetInvitation;

  /**
   * Property revocation
   *
   * @description
   * Revokes an invitation.
   *
   * @type {RevokeInvitation}
   * @readonly
   */
  private readonly revocation: RevokeInvitation;

  /**
   * Property resending
   *
   * @description
   * Sends an invitation again.
   *
   * @type {ResendInvitation}
   * @readonly
   */
  private readonly resending: ResendInvitation;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the invitation routes.
   *
   * @param {InviteMembers} inviting - Invites a batch of addresses.
   * @param {ListInvitations} listing - Lists the pending invitations.
   * @param {GetInvitation} reading - Reads one invitation in any state.
   * @param {RevokeInvitation} revocation - Revokes an invitation.
   * @param {ResendInvitation} resending - Sends an invitation again.
   * @constructor
   */
  public constructor(
    @Inject(InviteMembers) inviting: InviteMembers,
    @Inject(ListInvitations) listing: ListInvitations,
    @Inject(GetInvitation) reading: GetInvitation,
    @Inject(RevokeInvitation) revocation: RevokeInvitation,
    @Inject(ResendInvitation) resending: ResendInvitation,
  ) {
    this.inviting = inviting;
    this.listing = listing;
    this.reading = reading;
    this.revocation = revocation;
    this.resending = resending;
  }
  // #endregion

  // #region Methods
  /**
   * Method inviteMembers
   *
   * @description
   * `POST /v1/invitations`: invites the addresses with one role, `member` by default. A batch:
   * `200` with the outcome of each distinct address. A batch beyond the daily allowance of
   * invitation emails answers `429 invitation.daily-limit-reached` with `Retry-After`, derived
   * from `details.nextAvailableAt`.
   *
   * `If-Organization-Match` is checked before any call, for a keyed request too: a replay must
   * pass the precondition again. An `Idempotency-Key` of 1 to 255 characters sends the batch to
   * the keyed invitation of organization-service, unchanged; a key outside those bounds answers
   * `400 request.invalid` before any call. A keyed request answers
   * `409 idempotency.request-in-progress` and `422 idempotency.key-reused` as they are, and
   * `503 upstream.unavailable` with `Retry-After` while the serving release of
   * organization-service cannot replay keyed batches (nothing ran). Without a key, the batch
   * keeps the plain invitation.
   *
   * @param {z.output<typeof InviteMembersBody>} body - Addresses and role.
   * @param {string | undefined} idempotencyKeyHeader - `Idempotency-Key` of the request.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<InvitationBatchResult>} The outcome of each address.
   */
  @Post()
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'inviteMembers',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async inviteMembers(
    @Body(new ZodValidationPipe(InviteMembersBody)) body: z.output<typeof InviteMembersBody>,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InvitationBatchResult> {
    const idempotencyKey: string | undefined = toRequestHeader(
      'Idempotency-Key',
      InviteMembersHeader.shape['Idempotency-Key'],
      idempotencyKeyHeader,
    );
    return toInvitationBatchResult(
      await relayUpstream(
        response,
        idempotencyKey === undefined ? INVITE_PROBLEMS : KEYED_INVITE_PROBLEMS,
        () =>
          this.inviting.execute({
            emails: body.emails,
            role: body.role,
            ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
          }),
      ),
    );
  }

  /**
   * Method getInvitation
   *
   * @description
   * `GET /v1/invitations/{invitationId}`: an invitation of the current organization in any state.
   * organization-service decides who may read it (owner and admins). A caller who left the
   * organization (`404 organization.not-found`) gets the declared `404 invitation.not-found`. The
   * answer is private to the organization: `Cache-Control: private, no-store` (see
   * `createGatewayApplication`), and no conditional request is answered with a `304`.
   *
   * The handler writes the answer itself, so the `EtagInterceptor` of the kit sees no body and
   * sets no `ETag`: the expiry changes the state of an invitation without a new `version`, so a
   * tag derived from it would say "unchanged" for an answer that changed. organization-service
   * sends none either.
   *
   * @param {z.output<typeof GetInvitationParams>} params - The id of the invitation.
   * @param {Response} response - Response, written with the invitation.
   * @returns {Promise<void>} Resolves once the invitation is written.
   */
  @Get(':invitationId')
  @CredentialGuard.requires({
    operationId: 'getInvitation',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getInvitation(
    @Param(new ZodValidationPipe(GetInvitationParams))
    params: z.output<typeof GetInvitationParams>,
    @Res() response: Response,
  ): Promise<void> {
    const invitation: InvitationState = toInvitationState(
      await this.relay(GET_PROBLEMS, INVITATION_ALIASES, () =>
        this.reading.execute(params.invitationId),
      ),
    );
    response.status(200).json(invitation);
  }

  /**
   * Method listInvitations
   *
   * @description
   * `GET /v1/invitations`: one page of the pending invitations, the expired ones included.
   *
   * @param {z.output<typeof LIST_QUERY>} query - Cursor and page size.
   * @returns {Promise<InvitationPage>} One page of invitations.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listInvitations',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listInvitations(
    @Query(new ZodValidationPipe(LIST_QUERY)) query: z.output<typeof LIST_QUERY>,
  ): Promise<InvitationPage> {
    return toInvitationPage(
      await this.relay(ORGANIZATION_PROBLEMS, {}, () =>
        this.listing.execute({
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          limit: query.limit,
        }),
      ),
    );
  }

  /**
   * Method revokeInvitation
   *
   * @description
   * `DELETE /v1/invitations/{invitationId}`: revokes a pending invitation, expired or not. `204`,
   * also for an invitation revoked already.
   *
   * @param {z.output<typeof RevokeInvitationParams>} params - The id of the invitation.
   * @returns {Promise<void>} Resolves once the invitation is revoked.
   */
  @Delete(':invitationId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'revokeInvitation',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async revokeInvitation(
    @Param(new ZodValidationPipe(RevokeInvitationParams))
    params: z.output<typeof RevokeInvitationParams>,
  ): Promise<void> {
    await this.relay(REVOKE_PROBLEMS, INVITATION_ALIASES, () =>
      this.revocation.execute(params.invitationId),
    );
  }

  /**
   * Method resendInvitation
   *
   * @description
   * `POST /v1/invitations/{invitationId}/resend`: sends the email again and starts the 7 days
   * again. `200` with the invitation and its `ETag`. Within an hour of the last email, or beyond
   * the daily allowance of the organization, `429 invitation.resend-throttled` or
   * `429 invitation.daily-limit-reached` with `Retry-After`, derived from
   * `details.resendAvailableAt` or `details.nextAvailableAt`.
   *
   * @param {z.output<typeof EMPTY_BODY>} _body - The empty object.
   * @param {z.output<typeof RevokeInvitationParams>} params - The id of the invitation.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<Invitation>} The invitation, with its new expiry.
   */
  @Post(':invitationId/resend')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'resendInvitation',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async resendInvitation(
    @Body(new ZodValidationPipe(EMPTY_BODY)) _body: z.output<typeof EMPTY_BODY>,
    @Param(new ZodValidationPipe(RevokeInvitationParams))
    params: z.output<typeof RevokeInvitationParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Invitation> {
    return toInvitation(
      await relayUpstream(
        response,
        RESEND_PROBLEMS,
        () => this.resending.execute(params.invitationId),
        INVITATION_ALIASES,
      ),
    );
  }

  /**
   * Method relay
   *
   * @description
   * Runs a use case and translates its failure into the public problem of the route (see
   * `toPublicProblem`).
   *
   * @param {AcceptedProblems} accepted - Client errors the public operation declares.
   * @param {Readonly<Record<string, string>>} aliases - Public code of an internal code.
   * @param {() => Promise<TResult>} call - The use case.
   * @returns {Promise<TResult>} What the use case resolved with.
   */
  private async relay<TResult>(
    accepted: AcceptedProblems,
    aliases: Readonly<Record<string, string>>,
    call: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await call();
    } catch (error) {
      throw toPublicProblem(error, accepted, aliases);
    }
  }
  // #endregion
}
