import type { User } from '@cadenway/contracts/types/internal/identity-service';
import type { CurrentUser } from '@cadenway/contracts/types/public/auth';
import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { sessionExpiredProblem } from '../../auth/session-problems.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { verifiedSessionOf, type VerifiedSession } from '../../auth/verified-session.js';
import { isUpstreamProblem, toPublicProblem } from '../../problems/upstream-problem.js';
import { toCurrentUser } from '../current-user.js';
import { IDENTITY_USERS, type IdentityUsers } from './identity-users.port.js';

/**
 * Class MeController
 *
 * @description
 * `GET /v1/me` of `openapi/public/auth.yaml`: the account of the session. `SessionGuard`
 * introspects the cookie first (`401 auth.session-required` without one,
 * `401 auth.session-expired` once it ended); the account is then read with
 * `GET /internal/v1/users/{userId}` as that user, for the user the introspection returned, never
 * an id the request names. `ETag: "<version>"` comes from the `EtagInterceptor` of
 * `@cadenway/nest-common`, and `Cache-Control: no-store` from `MeRoutesModule`.
 */
@Controller('v1/me')
@UseGuards(SessionGuard)
export class MeController {
  // #region Properties
  /**
   * Property users
   *
   * @description
   * The accounts of identity-service.
   *
   * @type {IdentityUsers}
   * @readonly
   */
  private readonly users: IdentityUsers;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the port of the accounts.
   *
   * @param {IdentityUsers} users - The accounts of identity-service.
   * @constructor
   */
  public constructor(@Inject(IDENTITY_USERS) users: IdentityUsers) {
    this.users = users;
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
   * @throws {Error} When the request carries no verified session: `SessionGuard` did not run.
   */
  @Get()
  public async getCurrentUser(@Req() request: Request): Promise<CurrentUser> {
    const session: VerifiedSession | undefined = verifiedSessionOf(request);
    if (session === undefined) {
      throw new Error('GET /v1/me ran without a verified session.');
    }
    let user: User;
    try {
      user = await this.users.getUser(session.userId);
    } catch (error) {
      if (isUpstreamProblem(error, 404, 'user.not-found')) {
        throw sessionExpiredProblem();
      }
      throw toPublicProblem(error, {});
    }
    return toCurrentUser(user);
  }
  // #endregion
}
