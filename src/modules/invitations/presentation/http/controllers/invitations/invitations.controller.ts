import type {
  Invitation,
  InvitationBatchResult,
  InvitationPage,
} from '@cadenway/contracts/types/public/members';
import {
  InviteMembersBody,
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
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { toQueryInteger } from '../../../../../../presentation/http/mappers/query-parameters.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { InviteMembers } from '../../../../application/use-cases/commands/invitations/invite-members/invite-members.use-case.js';
import { ResendInvitation } from '../../../../application/use-cases/commands/invitations/resend-invitation/resend-invitation.use-case.js';
import { RevokeInvitation } from '../../../../application/use-cases/commands/invitations/revoke-invitation/revoke-invitation.use-case.js';
import { ListInvitations } from '../../../../application/use-cases/queries/invitations/list-invitations/list-invitations.use-case.js';
import {
  toInvitation,
  toInvitationBatchResult,
  toInvitationPage,
} from '../../mappers/invitations/invitation.mapper.js';

/**
 * Constant ORGANIZATION_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `POST /v1/invitations` and `GET /v1/invitations`
 * answer as they are.
 *
 * @type {AcceptedProblems}
 */
const ORGANIZATION_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['organization.not-found'],
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
 * answers as they are.
 *
 * @type {AcceptedProblems}
 */
const RESEND_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['invitation.not-found'],
  409: ['invitation.revoked', 'invitation.answered'],
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
 * The query of `GET /v1/invitations` as the contract validates it, with `limit` read from its
 * text first.
 *
 * @type {z.ZodType<z.output<typeof ListInvitationsQueryParams>>}
 */
const LIST_QUERY = ListInvitationsQueryParams.extend({
  limit: z.preprocess(toQueryInteger, ListInvitationsQueryParams.shape.limit),
});

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
 * batch of addresses, list the pending invitations, revoke one and send one again. Session only:
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
   * @param {RevokeInvitation} revocation - Revokes an invitation.
   * @param {ResendInvitation} resending - Sends an invitation again.
   * @constructor
   */
  public constructor(
    @Inject(InviteMembers) inviting: InviteMembers,
    @Inject(ListInvitations) listing: ListInvitations,
    @Inject(RevokeInvitation) revocation: RevokeInvitation,
    @Inject(ResendInvitation) resending: ResendInvitation,
  ) {
    this.inviting = inviting;
    this.listing = listing;
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
   * `200` with the outcome of each distinct address.
   *
   * @param {z.output<typeof InviteMembersBody>} body - Addresses and role.
   * @returns {Promise<InvitationBatchResult>} The outcome of each address.
   */
  @Post()
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'inviteMembers',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async inviteMembers(
    @Body(new ZodValidationPipe(InviteMembersBody)) body: z.output<typeof InviteMembersBody>,
  ): Promise<InvitationBatchResult> {
    return toInvitationBatchResult(
      await this.relay(ORGANIZATION_PROBLEMS, {}, () =>
        this.inviting.execute({ emails: body.emails, role: body.role }),
      ),
    );
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
   * again. `200` with the invitation and its `ETag`.
   *
   * @param {z.output<typeof EMPTY_BODY>} _body - The empty object.
   * @param {z.output<typeof RevokeInvitationParams>} params - The id of the invitation.
   * @returns {Promise<Invitation>} The invitation, with its new expiry.
   */
  @Post(':invitationId/resend')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'resendInvitation',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async resendInvitation(
    @Body(new ZodValidationPipe(EMPTY_BODY)) _body: z.output<typeof EMPTY_BODY>,
    @Param(new ZodValidationPipe(RevokeInvitationParams))
    params: z.output<typeof RevokeInvitationParams>,
  ): Promise<Invitation> {
    return toInvitation(
      await this.relay(RESEND_PROBLEMS, INVITATION_ALIASES, () =>
        this.resending.execute(params.invitationId),
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
