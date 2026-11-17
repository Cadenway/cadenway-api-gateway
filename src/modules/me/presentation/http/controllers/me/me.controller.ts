import type { CurrentUser } from '@cadenway/contracts/types/public/auth';
import { UpdateCurrentUserBody } from '@cadenway/contracts/validators/public/auth';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Body, Controller, Get, Headers, Inject, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';

import { sessionExpiredProblem } from '../../../../../../problems/session-problems.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import {
  isUpstreamProblem,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { toCurrentUser } from '../../../../../../presentation/http/mappers/current-user.mapper.js';
import { GetCurrentUser } from '../../../../application/use-cases/queries/me/get-current-user/get-current-user.use-case.js';
import { UpdateCurrentUser } from '../../../../application/use-cases/commands/me/update-current-user/update-current-user.use-case.js';

import type { GetCurrentUserOutput } from '../../../../application/use-cases/queries/me/get-current-user/get-current-user.output.js';
import type { UpdateCurrentUserInput } from '../../../../application/use-cases/commands/me/update-current-user/update-current-user.input.js';

/**
 * Constant UPDATE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `PATCH /v1/me` answers as they are: an invalid value
 * (an unknown time zone, `details.issues` on `timeZone`) and a stale `If-Match`.
 *
 * @type {AcceptedProblems}
 */
const UPDATE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  412: ['request.version-mismatch'],
};

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
    throw new Error('A route of /v1/me ran without a verified session.');
  }
  return session;
}

/**
 * Function toProfileChanges
 *
 * @description
 * Maps the public JSON Merge Patch to the change of the profile, member by member: a member left
 * out stays out, a `null` stays `null`.
 *
 * @param {z.output<typeof UpdateCurrentUserBody>} body - The validated patch.
 * @returns {UpdateCurrentUserInput['changes']} The change of the profile.
 */
function toProfileChanges(
  body: z.output<typeof UpdateCurrentUserBody>,
): UpdateCurrentUserInput['changes'] {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
    ...(body.jobTitle === undefined ? {} : { jobTitle: body.jobTitle }),
    ...(body.timeZone === undefined ? {} : { timeZone: body.timeZone }),
    ...(body.language === undefined ? {} : { language: body.language }),
  };
}

/**
 * Class MeController
 *
 * @description
 * `GET /v1/me` and `PATCH /v1/me` of `openapi/public/auth.yaml`: the account of the session and
 * its profile. `CredentialGuard` introspects the cookie first (`401 auth.session-required`
 * without one, `401 auth.session-expired` once it ended, `403 auth.api-token-not-accepted` for a
 * personal API token); `RateLimitGuard` counts the session. The account is then read or changed
 * as that user, for the user the introspection returned, never an id the request names.
 * `ETag: "<version>"` comes from the `EtagInterceptor` of `@cadenway/nest-common`, and
 * `Cache-Control: no-store` from `MeRoutesModule`.
 */
@Controller('v1/me')
@UseGuards(CredentialGuard, RateLimitGuard)
export class MeController {
  // #region Properties
  /**
   * Property users
   *
   * @description
   * Reads the account of identity-service.
   *
   * @type {GetCurrentUser}
   * @readonly
   */
  private readonly users: GetCurrentUser;

  /**
   * Property profiles
   *
   * @description
   * Changes the profile of the account at identity-service.
   *
   * @type {UpdateCurrentUser}
   * @readonly
   */
  private readonly profiles: UpdateCurrentUser;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the current account.
   *
   * @param {GetCurrentUser} users - Reads the account of identity-service.
   * @param {UpdateCurrentUser} profiles - Changes the profile of the account.
   * @constructor
   */
  public constructor(
    @Inject(GetCurrentUser) users: GetCurrentUser,
    @Inject(UpdateCurrentUser) profiles: UpdateCurrentUser,
  ) {
    this.users = users;
    this.profiles = profiles;
  }
  // #endregion

  // #region Methods
  /**
   * Method getCurrentUser
   *
   * @description
   * Answers the account of the session. An account identity-service no longer finds
   * (`404 user.not-found`) ends the session for the applications: `401 auth.session-expired`,
   * since the public route declares no `404`. Any other client error of identity-service is
   * `503 upstream.failed`.
   *
   * @param {Request} request - Request, for its verified session.
   * @returns {Promise<CurrentUser>} The signed-in user.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'getCurrentUser',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async getCurrentUser(@Req() request: Request): Promise<CurrentUser> {
    const session: RequestSession = sessionOf(request);
    let user: GetCurrentUserOutput;
    try {
      user = await this.users.execute(session.userId);
    } catch (error) {
      throw this.translate(error, {});
    }
    return toCurrentUser(user);
  }

  /**
   * Method updateCurrentUser
   *
   * @description
   * Applies a JSON Merge Patch to the profile of the account of the session, relaying `If-Match`
   * unchanged. `400 request.invalid` and `412 request.version-mismatch` of identity-service are
   * answered as they are; an account it no longer finds is `401 auth.session-expired`, as for the
   * reading.
   *
   * @param {z.output<typeof UpdateCurrentUserBody>} body - The patch.
   * @param {string | undefined} ifMatch - `If-Match` of the request.
   * @param {Request} request - Request, for its verified session.
   * @returns {Promise<CurrentUser>} The account after the change.
   */
  @Patch()
  @CredentialGuard.requires({
    operationId: 'updateCurrentUser',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async updateCurrentUser(
    @Body(new ZodValidationPipe(UpdateCurrentUserBody))
    body: z.output<typeof UpdateCurrentUserBody>,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: Request,
  ): Promise<CurrentUser> {
    const session: RequestSession = sessionOf(request);
    let user: GetCurrentUserOutput;
    try {
      user = await this.profiles.execute({
        userId: session.userId,
        changes: toProfileChanges(body),
        ifMatch,
      });
    } catch (error) {
      throw this.translate(error, UPDATE_PROBLEMS);
    }
    return toCurrentUser(user);
  }

  /**
   * Method translate
   *
   * @description
   * Translates a failure of identity-service: `404 user.not-found` ends the session
   * (`401 auth.session-expired`), the declared client errors are answered as they are, any other
   * one is `503 upstream.*`.
   *
   * @param {unknown} error - What the use case threw.
   * @param {AcceptedProblems} accepted - Client errors the public operation declares.
   * @returns {unknown} The error to throw.
   */
  private translate(error: unknown, accepted: AcceptedProblems): unknown {
    if (isUpstreamProblem(error, 404, 'user.not-found')) {
      return sessionExpiredProblem();
    }
    return toPublicProblem(error, accepted);
  }
  // #endregion
}
