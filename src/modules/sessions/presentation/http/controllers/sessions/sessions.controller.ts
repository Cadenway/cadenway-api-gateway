import type { OpenSessionPage, RevokedSessions } from '@cadenway/contracts/types/public/auth';
import {
  ListSessionsQueryParams,
  RevokeOtherSessionsBody,
  RevokeSessionParams,
} from '@cadenway/contracts/validators/public/auth';
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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import {
  relaySessionUpstream,
  relayUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { RevokeOtherSessions } from '../../../../application/use-cases/commands/sessions/revoke-other-sessions/revoke-other-sessions.use-case.js';
import { RevokeSession } from '../../../../application/use-cases/commands/sessions/revoke-session/revoke-session.use-case.js';
import { ListSessions } from '../../../../application/use-cases/queries/sessions/list-sessions/list-sessions.use-case.js';
import type { RevokedSessions as InternalRevokedSessions } from '../../../../application/models/sessions/revoked-sessions.model.js';
import { toOpenSessionPage } from '../../mappers/sessions/open-session.mapper.js';

/**
 * Constant LIST_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `GET /v1/sessions` answers as they are: the cursor comes
 * from the browser, so an internal `400 request.invalid` is relayed.
 *
 * @type {AcceptedProblems}
 */
const LIST_PROBLEMS: AcceptedProblems = { 400: ['request.invalid'] };

/**
 * Constant REVOKE_OTHERS_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/sessions/revoke-others` answers as they are:
 * none. The internal call has no body and its path is the introspected session, so an internal
 * `400` is a defect of the gateway or of identity-service, answered `503 upstream.failed`, never
 * blamed on the browser (as for the sign-out).
 *
 * @type {AcceptedProblems}
 */
const REVOKE_OTHERS_PROBLEMS: AcceptedProblems = {};

/**
 * Constant REVOKE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `DELETE /v1/sessions/{sessionId}` answers as they are:
 * `404 session.not-found` for a session of another account or an unknown id, relayed as is (the
 * id is the one of the public path, not the session of the request). The gateway has checked that
 * id is a UUID and sends no body, so an internal `400` is a defect: `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const REVOKE_PROBLEMS: AcceptedProblems = {
  404: ['session.not-found'],
};

/**
 * Constant LIST_ENDED_SESSION
 *
 * @description
 * The internal `404` codes of the list that end the session for the applications
 * (`401 auth.session-expired`): `currentSessionId` is no longer an open session of the user, or
 * the account can no longer be read.
 *
 * @type {readonly string[]}
 */
const LIST_ENDED_SESSION: readonly string[] = ['session.not-found', 'user.not-found'];

/**
 * Constant REVOKE_OTHERS_ENDED_SESSION
 *
 * @description
 * The internal `404` code of the closing of the other sessions that ends the session for the
 * applications (`401 auth.session-expired`): the session of the request is no longer open.
 *
 * @type {readonly string[]}
 */
const REVOKE_OTHERS_ENDED_SESSION: readonly string[] = ['session.not-found'];

/**
 * Constant STRICT_REVOKE_OTHERS_BODY
 *
 * @description
 * Validator of the body of `POST /v1/sessions/revoke-others`: an empty object, with no other
 * member (`additionalProperties: false` of `EmptyRequest`, which the generated validator does not
 * enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const STRICT_REVOKE_OTHERS_BODY: z.ZodType<Record<string, never>> =
  RevokeOtherSessionsBody.strict();

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
    throw new Error('A route of /v1/sessions ran without a verified session.');
  }
  return session;
}

/**
 * Class SessionsController
 *
 * @description
 * The routes of the tag `sessions` of `openapi/public/auth.yaml`: list the open sessions of the
 * account, close one, close every other. Session only: `CredentialGuard` introspects the cookie
 * (`401` without an active one, `403 auth.api-token-not-accepted` for a personal API token,
 * `403 auth.csrf-rejected` for an unsafe request without an allowed `Origin`; a bodiless `DELETE`
 * passes on its `Origin` alone); `RateLimitGuard` counts the session. The account and the session
 * of the request are the ones the introspection returned, never values of the request. Every
 * answer carries `Cache-Control: no-store` (see `SessionsModule`). Recent authentication is not
 * required.
 */
@Controller('v1/sessions')
@UseGuards(CredentialGuard, RateLimitGuard)
export class SessionsController {
  // #region Properties
  /**
   * Property listing
   *
   * @description
   * Lists the open sessions.
   *
   * @type {ListSessions}
   * @readonly
   */
  private readonly listing: ListSessions;

  /**
   * Property revocation
   *
   * @description
   * Closes one session.
   *
   * @type {RevokeSession}
   * @readonly
   */
  private readonly revocation: RevokeSession;

  /**
   * Property othersRevocation
   *
   * @description
   * Closes every other session.
   *
   * @type {RevokeOtherSessions}
   * @readonly
   */
  private readonly othersRevocation: RevokeOtherSessions;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the session routes.
   *
   * @param {ListSessions} listing - Lists the open sessions.
   * @param {RevokeSession} revocation - Closes one session.
   * @param {RevokeOtherSessions} othersRevocation - Closes every other session.
   * @constructor
   */
  public constructor(
    @Inject(ListSessions) listing: ListSessions,
    @Inject(RevokeSession) revocation: RevokeSession,
    @Inject(RevokeOtherSessions) othersRevocation: RevokeOtherSessions,
  ) {
    this.listing = listing;
    this.revocation = revocation;
    this.othersRevocation = othersRevocation;
  }
  // #endregion

  // #region Methods
  /**
   * Method listSessions
   *
   * @description
   * `GET /v1/sessions`: one page of the open sessions of the account, the session of the request
   * marked `current`. A session that ended since its introspection is `401 auth.session-expired`.
   *
   * @param {z.output<typeof ListSessionsQueryParams>} query - Cursor and page size.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<OpenSessionPage>} One page of the open sessions.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listSessions',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async listSessions(
    @Query(new ZodValidationPipe(ListSessionsQueryParams))
    query: z.output<typeof ListSessionsQueryParams>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OpenSessionPage> {
    const session: RequestSession = sessionOf(request);
    return toOpenSessionPage(
      await relaySessionUpstream(
        response,
        LIST_PROBLEMS,
        () =>
          this.listing.execute({
            userId: session.userId,
            currentSessionId: session.sessionId,
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
            limit: query.limit,
          }),
        LIST_ENDED_SESSION,
      ),
    );
  }

  /**
   * Method revokeSession
   *
   * @description
   * `DELETE /v1/sessions/{sessionId}`: closes a session of the account, `204`, also for one that
   * already ended. `404 session.not-found` of identity-service is relayed as is: here it names the
   * session of the path, of another account or unknown, not the session of the request. The
   * current session can be closed too; its cookie stays until its next request finds it ended.
   *
   * @param {z.output<typeof RevokeSessionParams>} params - The id of the session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<void>} Resolves once the session is closed.
   */
  @Delete(':sessionId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'revokeSession',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async revokeSession(
    @Param(new ZodValidationPipe(RevokeSessionParams))
    params: z.output<typeof RevokeSessionParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await relayUpstream(response, REVOKE_PROBLEMS, () => this.revocation.execute(params.sessionId));
  }

  /**
   * Method revokeOtherSessions
   *
   * @description
   * `POST /v1/sessions/revoke-others`: closes every open session of the account except the one of
   * the request. `200` with the count. A session that ended since its introspection is
   * `401 auth.session-expired`.
   *
   * @param {z.output<typeof STRICT_REVOKE_OTHERS_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<RevokedSessions>} How many sessions were closed.
   */
  @Post('revoke-others')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'revokeOtherSessions',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async revokeOtherSessions(
    @Body(new ZodValidationPipe(STRICT_REVOKE_OTHERS_BODY))
    _body: z.output<typeof STRICT_REVOKE_OTHERS_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RevokedSessions> {
    const session: RequestSession = sessionOf(request);
    const revoked: InternalRevokedSessions = await relaySessionUpstream(
      response,
      REVOKE_OTHERS_PROBLEMS,
      () => this.othersRevocation.execute(session.sessionId),
      REVOKE_OTHERS_ENDED_SESSION,
    );
    return { revokedCount: revoked.revokedCount };
  }
  // #endregion
}
