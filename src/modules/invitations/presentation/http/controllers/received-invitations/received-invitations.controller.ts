import type {
  JoinedOrganization,
  ReceivedInvitationPage,
} from '@cadenway/contracts/types/public/members';
import {
  AcceptInvitationBody,
  AcceptInvitationParams,
  ListReceivedInvitationsQueryParams,
} from '@cadenway/contracts/validators/public/members';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

import {
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { toQueryInteger } from '../../../../../../presentation/http/mappers/query-parameters.mapper.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { AcceptInvitation } from '../../../../application/use-cases/commands/received/accept-invitation/accept-invitation.use-case.js';
import { RefuseInvitation } from '../../../../application/use-cases/commands/received/refuse-invitation/refuse-invitation.use-case.js';
import { ListReceivedInvitations } from '../../../../application/use-cases/queries/received/list-received-invitations/list-received-invitations.use-case.js';
import {
  toJoinedOrganization,
  toReceivedInvitationPage,
} from '../../mappers/received-invitations/received-invitation.mapper.js';

/**
 * Constant LIST_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/me/invitations` answers as they are. Its
 * `404 user.not-found` (a path user that is not the actor) cannot follow from the request: the
 * path user is the one of the introspection, so it is a defect, `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_PROBLEMS: AcceptedProblems = { 400: ['request.invalid'] };

/**
 * Constant ANSWER_PROBLEMS
 *
 * @description
 * Client errors of organization-service that the acceptance and the refusal answer as they are,
 * in the order the contract checks them.
 *
 * @type {AcceptedProblems}
 */
const ANSWER_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['invitation.email-mismatch'],
  404: ['invitation.not-found'],
  409: ['invitation.revoked', 'invitation.answered', 'invitation.expired'],
};

/**
 * Constant LIST_QUERY
 *
 * @description
 * The query of `GET /v1/me/invitations` as the contract validates it, with `limit` read from its
 * text first.
 *
 * @type {z.ZodType<z.output<typeof ListReceivedInvitationsQueryParams>>}
 */
const LIST_QUERY = ListReceivedInvitationsQueryParams.extend({
  limit: z.preprocess(toQueryInteger, ListReceivedInvitationsQueryParams.shape.limit),
});

/**
 * Constant EMPTY_BODY
 *
 * @description
 * Validator of the body of the acceptance and the refusal: an empty object, with no other member
 * (`additionalProperties: false` in the contract, which the generated validator does not enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const EMPTY_BODY: z.ZodType<Record<string, never>> = AcceptInvitationBody.strict();

/**
 * Function sessionOf
 *
 * @description
 * The verified session of a request of this controller.
 *
 * @param {Request} request - Incoming request.
 * @returns {RequestSession} The session `CredentialGuard` verified.
 * @throws {Error} When the request carries no verified session: the guard did not run.
 */
function sessionOf(request: Request): RequestSession {
  const session: RequestSession | undefined = verifiedSessionOf(request);
  if (session === undefined) {
    throw new Error('A route of /v1/me/invitations ran without a verified session.');
  }
  return session;
}

/**
 * Class ReceivedInvitationsController
 *
 * @description
 * The routes of `openapi/public/members.yaml` under `/v1/me/invitations`: the invitations
 * addressed to the caller, from every organization, whatever the current one, and their
 * acceptance or refusal. Session only: `CredentialGuard` answers a personal API token
 * `403 auth.api-token-not-accepted`; `RateLimitGuard` counts the session. The user of each call
 * is the one the introspection returned, never one the request names; organization-service checks
 * the verified address and the state of the invitation.
 */
@Controller('v1/me/invitations')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ReceivedInvitationsController {
  // #region Properties
  /**
   * Property listing
   *
   * @description
   * Lists the invitations addressed to the caller.
   *
   * @type {ListReceivedInvitations}
   * @readonly
   */
  private readonly listing: ListReceivedInvitations;

  /**
   * Property acceptance
   *
   * @description
   * Accepts an invitation.
   *
   * @type {AcceptInvitation}
   * @readonly
   */
  private readonly acceptance: AcceptInvitation;

  /**
   * Property refusal
   *
   * @description
   * Refuses an invitation.
   *
   * @type {RefuseInvitation}
   * @readonly
   */
  private readonly refusal: RefuseInvitation;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the invitee.
   *
   * @param {ListReceivedInvitations} listing - Lists the invitations addressed to the caller.
   * @param {AcceptInvitation} acceptance - Accepts an invitation.
   * @param {RefuseInvitation} refusal - Refuses an invitation.
   * @constructor
   */
  public constructor(
    @Inject(ListReceivedInvitations) listing: ListReceivedInvitations,
    @Inject(AcceptInvitation) acceptance: AcceptInvitation,
    @Inject(RefuseInvitation) refusal: RefuseInvitation,
  ) {
    this.listing = listing;
    this.acceptance = acceptance;
    this.refusal = refusal;
  }
  // #endregion

  // #region Methods
  /**
   * Method listReceivedInvitations
   *
   * @description
   * `GET /v1/me/invitations`: one page of the pending invitations addressed to the verified
   * address of the caller, not expired.
   *
   * @param {z.output<typeof LIST_QUERY>} query - Cursor and page size.
   * @param {Request} request - Request, for its verified session.
   * @returns {Promise<ReceivedInvitationPage>} One page of invitations.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listReceivedInvitations',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async listReceivedInvitations(
    @Query(new ZodValidationPipe(LIST_QUERY)) query: z.output<typeof LIST_QUERY>,
    @Req() request: Request,
  ): Promise<ReceivedInvitationPage> {
    const { userId }: RequestSession = sessionOf(request);
    return toReceivedInvitationPage(
      await this.relay(LIST_PROBLEMS, () =>
        this.listing.execute({
          userId,
          page: {
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
            limit: query.limit,
          },
        }),
      ),
    );
  }

  /**
   * Method acceptInvitation
   *
   * @description
   * `POST /v1/me/invitations/{invitationId}/accept`: makes the caller a member of the
   * organization of the invitation. `200` with the organization as the picker lists it. The
   * session does not move to it.
   *
   * @param {z.output<typeof AcceptInvitationParams>} params - The id of the invitation.
   * @param {z.output<typeof EMPTY_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @returns {Promise<JoinedOrganization>} The organization joined.
   */
  @Post(':invitationId/accept')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'acceptInvitation',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async acceptInvitation(
    @Param(new ZodValidationPipe(AcceptInvitationParams))
    params: z.output<typeof AcceptInvitationParams>,
    @Body(new ZodValidationPipe(EMPTY_BODY)) _body: z.output<typeof EMPTY_BODY>,
    @Req() request: Request,
  ): Promise<JoinedOrganization> {
    const { userId }: RequestSession = sessionOf(request);
    return toJoinedOrganization(
      await this.relay(ANSWER_PROBLEMS, () =>
        this.acceptance.execute({ userId, invitationId: params.invitationId }),
      ),
    );
  }

  /**
   * Method refuseInvitation
   *
   * @description
   * `POST /v1/me/invitations/{invitationId}/refuse`: refuses the invitation. `204`.
   *
   * @param {z.output<typeof AcceptInvitationParams>} params - The id of the invitation.
   * @param {z.output<typeof EMPTY_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @returns {Promise<void>} Resolves once the invitation is refused.
   */
  @Post(':invitationId/refuse')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'refuseInvitation',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async refuseInvitation(
    @Param(new ZodValidationPipe(AcceptInvitationParams))
    params: z.output<typeof AcceptInvitationParams>,
    @Body(new ZodValidationPipe(EMPTY_BODY)) _body: z.output<typeof EMPTY_BODY>,
    @Req() request: Request,
  ): Promise<void> {
    const { userId }: RequestSession = sessionOf(request);
    await this.relay(ANSWER_PROBLEMS, () =>
      this.refusal.execute({ userId, invitationId: params.invitationId }),
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
   * @param {() => Promise<TResult>} call - The use case.
   * @returns {Promise<TResult>} What the use case resolved with.
   */
  private async relay<TResult>(
    accepted: AcceptedProblems,
    call: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await call();
    } catch (error) {
      throw toPublicProblem(error, accepted);
    }
  }
  // #endregion
}
