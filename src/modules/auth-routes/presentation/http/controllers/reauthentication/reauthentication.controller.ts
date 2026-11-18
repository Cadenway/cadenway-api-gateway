import type { RecentAuthentication } from '@cadenway/contracts/types/public/auth';
import { ReauthenticateBody } from '@cadenway/contracts/validators/public/auth';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import {
  relaySessionUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { Reauthenticate } from '../../../../application/use-cases/commands/auth/reauthenticate/reauthenticate.use-case.js';
import type { RecentAuthentication as InternalRecentAuthentication } from '../../../../application/models/auth/recent-authentication.model.js';

/**
 * Constant REAUTHENTICATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/reauthentication` answers as they are: a
 * wrong password (`PasswordRefused`) and the lockout it shares with the sign-in
 * (`AccountLocked`), with `Retry-After` derived from `details.lockedUntil`.
 *
 * @type {AcceptedProblems}
 */
const REAUTHENTICATION_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  422: ['auth.password-incorrect'],
  429: ['auth.account-locked'],
};

/**
 * Constant ENDED_SESSION
 *
 * @description
 * The internal `404` code of `POST /internal/v1/sessions/{sessionId}/reauthentication` that means
 * the session of the request ended after its introspection: `401 auth.session-expired`.
 *
 * @type {readonly string[]}
 */
const ENDED_SESSION: readonly string[] = ['session.not-found'];

/**
 * Class ReauthenticationController
 *
 * @description
 * `POST /v1/auth/reauthentication` of `openapi/public/auth.yaml`: the one route under `/v1/auth`
 * that needs a session, so it is guarded like the other session routes rather than like the flows
 * of `AuthController`. `CredentialGuard` reads the cookie first (`401 auth.session-required`
 * without one, `401 auth.session-expired` once it ended), applies the cross-site check to a cookie
 * request (`403 auth.csrf-rejected` without an exact allowed `Origin` and
 * `Content-Type: application/json`), and answers a personal API token, which needs no `Origin`,
 * `403 auth.api-token-not-accepted`; `RateLimitGuard` counts the session. Every answer carries
 * `Cache-Control: no-store` (see `AuthRoutesModule`). The password travels in the body only and
 * is never logged.
 */
@Controller('v1/auth')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ReauthenticationController {
  // #region Properties
  /**
   * Property reauthentication
   *
   * @description
   * Confirms the password of the person of the session.
   *
   * @type {Reauthenticate}
   * @readonly
   */
  private readonly reauthentication: Reauthenticate;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use case of the re-authentication.
   *
   * @param {Reauthenticate} reauthentication - Confirms the password in the session.
   * @constructor
   */
  public constructor(@Inject(Reauthenticate) reauthentication: Reauthenticate) {
    this.reauthentication = reauthentication;
  }
  // #endregion

  // #region Methods
  /**
   * Method reauthenticate
   *
   * @description
   * `POST /v1/auth/reauthentication`: confirms the password of the person of the session, which
   * opens the 10-minute window of recent authentication of this session. The session is the one
   * the introspection returned, never one the request names. `422 auth.password-incorrect` and
   * `429 auth.account-locked` (with `Retry-After`) are answered as they are; a session that ended
   * since its introspection (`404 session.not-found`) is `401 auth.session-expired`.
   *
   * @param {z.output<typeof ReauthenticateBody>} body - The password.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<RecentAuthentication>} The window of recent authentication.
   * @throws {Error} When the request carries no verified session: the guard did not run.
   */
  @Post('reauthentication')
  @CredentialGuard.requires({
    operationId: 'reauthenticate',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  @HttpCode(200)
  public async reauthenticate(
    @Body(new ZodValidationPipe(ReauthenticateBody)) body: z.output<typeof ReauthenticateBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RecentAuthentication> {
    const session: RequestSession | undefined = verifiedSessionOf(request);
    if (session === undefined) {
      throw new Error('POST /v1/auth/reauthentication ran without a verified session.');
    }
    const recent: InternalRecentAuthentication = await relaySessionUpstream(
      response,
      REAUTHENTICATION_PROBLEMS,
      () =>
        this.reauthentication.execute({
          sessionId: session.sessionId,
          password: body.password,
        }),
      ENDED_SESSION,
    );
    return { authenticatedAt: recent.authenticatedAt, expiresAt: recent.expiresAt };
  }
  // #endregion
}
