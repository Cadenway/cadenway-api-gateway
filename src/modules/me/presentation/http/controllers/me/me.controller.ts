import type {
  CurrentUser,
  DeletionScheduled,
  EmailChangeCodeSent,
} from '@cadenway/contracts/types/public/auth';
import {
  ChangePasswordBody,
  ConfirmEmailChangeBody,
  RequestEmailChangeBody,
  ScheduleAccountDeletionBody,
  UpdateCurrentUserBody,
} from '@cadenway/contracts/validators/public/auth';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { sessionExpiredProblem } from '../../../../../../problems/session-problems.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import { CLEARED_SESSION_COOKIE } from '../../../../../../presentation/http/session/session-cookie.js';
import {
  isUpstreamProblem,
  relaySessionUpstream,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { browserClient } from '../../../../../../presentation/http/mappers/browser-client.mapper.js';
import { toCurrentUser } from '../../../../../../presentation/http/mappers/current-user.mapper.js';
import { GetCurrentUser } from '../../../../application/use-cases/queries/me/get-current-user/get-current-user.use-case.js';
import { UpdateCurrentUser } from '../../../../application/use-cases/commands/me/update-current-user/update-current-user.use-case.js';
import { ChangePassword } from '../../../../application/use-cases/commands/me/change-password/change-password.use-case.js';
import { RequestEmailChange } from '../../../../application/use-cases/commands/me/request-email-change/request-email-change.use-case.js';
import { ConfirmEmailChange } from '../../../../application/use-cases/commands/me/confirm-email-change/confirm-email-change.use-case.js';
import { ScheduleAccountDeletion } from '../../../../application/use-cases/commands/me/schedule-account-deletion/schedule-account-deletion.use-case.js';

import type { GetCurrentUserOutput } from '../../../../application/use-cases/queries/me/get-current-user/get-current-user.output.js';
import type { UpdateCurrentUserInput } from '../../../../application/use-cases/commands/me/update-current-user/update-current-user.input.js';
import type { EmailChangeCodeSent as InternalEmailChangeCodeSent } from '../../../../application/models/me/email-change-code-sent.model.js';
import type { DeletionScheduled as InternalDeletionScheduled } from '../../../../application/models/me/deletion-scheduled.model.js';

/**
 * Constant INVALID_REQUEST
 *
 * @description
 * The `400` every route of this controller with a body declares.
 *
 * @type {readonly string[]}
 */
const INVALID_REQUEST: readonly string[] = ['request.invalid'];

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
  400: INVALID_REQUEST,
  412: ['request.version-mismatch'],
};

/**
 * Constant CHANGE_PASSWORD_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `PUT /v1/me/password` answers as they are, in the order
 * identity-service checks them: the new password (`PasswordChangeRefused`), then, for an account
 * with two-step verification only, its recent two-step proof (`403 auth.reauthentication-required`
 * with `details.methods: [authenticator-app]`, before the current password is checked or counted),
 * then the current password and the lockout it shares with the sign-in (`AccountLocked`), with
 * `Retry-After` derived from `details.lockedUntil`.
 *
 * @type {AcceptedProblems}
 */
const CHANGE_PASSWORD_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  403: ['auth.reauthentication-required'],
  422: ['auth.password-too-short', 'auth.password-compromised', 'auth.password-incorrect'],
  429: ['auth.account-locked'],
};

/**
 * Constant REAUTHENTICATION_REQUIRED
 *
 * @description
 * The `403` identity-service answers to a guarded route without a recent authentication of the
 * session, with `details.methods`; the gateway forwards it with its French title.
 *
 * @type {readonly string[]}
 */
const REAUTHENTICATION_REQUIRED: readonly string[] = ['auth.reauthentication-required'];

/**
 * Constant EMAIL_CHANGE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/me/email-change` answers as they are, in the
 * order identity-service checks them: recent authentication, current address, address taken,
 * throttle of the codes of the new address (with `Retry-After` derived from
 * `details.resendAvailableAt`).
 *
 * @type {AcceptedProblems}
 */
const EMAIL_CHANGE_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  403: REAUTHENTICATION_REQUIRED,
  409: ['auth.email-taken'],
  422: ['auth.email-unchanged'],
  429: ['auth.code-throttled'],
};

/**
 * Constant EMAIL_CHANGE_CONFIRMATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/me/email-change/confirmation` answers as they
 * are: a refused code (`EmailChangeCodeRefused`) and an address taken since the request.
 *
 * @type {AcceptedProblems}
 */
const EMAIL_CHANGE_CONFIRMATION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  409: ['auth.email-taken'],
  422: ['auth.code-invalid', 'auth.code-expired'],
};

/**
 * Constant DELETION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/me/deletion` answers as they are: an owned
 * organization (`details.organizationIds`), checked first, then the recent authentication. The
 * internal body holds only the introspected session, so an internal `400` is a defect of the
 * gateway or of identity-service, answered `503 upstream.failed`, never blamed on the browser.
 *
 * @type {AcceptedProblems}
 */
const DELETION_PROBLEMS: AcceptedProblems = {
  403: REAUTHENTICATION_REQUIRED,
  409: ['account.organization-owner'],
};

/**
 * Constant ENDED_SESSION
 *
 * @description
 * The internal `404` codes of the routes about the security of the account that end the session
 * for the applications (`401 auth.session-expired`): the session of the request is no longer an
 * open session of the user (`session.not-found`), or the account can no longer be read
 * (`user.not-found`). The public routes declare no `404`.
 *
 * @type {readonly string[]}
 */
const ENDED_SESSION: readonly string[] = ['session.not-found', 'user.not-found'];

/**
 * Constant STRICT_DELETION_BODY
 *
 * @description
 * Validator of the body of the deletion: an empty object, with no other member
 * (`additionalProperties: false` of `EmptyRequest`, which the generated validator does not
 * enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const STRICT_DELETION_BODY: z.ZodType<Record<string, never>> = ScheduleAccountDeletionBody.strict();

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
 * The routes of `openapi/public/auth.yaml` under `/v1/me`: the account of the session, its
 * profile, and the security of the account (password, address, deletion). Session only:
 * `CredentialGuard` introspects the cookie first (`401 auth.session-required` without one,
 * `401 auth.session-expired` once it ended, `403 auth.api-token-not-accepted` for a personal API
 * token, `403 auth.csrf-rejected` for an unsafe request without an allowed `Origin` and
 * `Content-Type: application/json`); `RateLimitGuard` counts the session. The account is then read
 * or changed as that user, for the user and the session the introspection returned, never an id
 * the request names.
 *
 * - `ETag: "<version>"` comes from the `EtagInterceptor` of `@cadenway/nest-common` on every
 *   answer that carries the account, and `Cache-Control: no-store` from `MeRoutesModule`.
 * - The change of address and the deletion need a recent authentication of the session:
 *   identity-service answers `403 auth.reauthentication-required`, which the gateway forwards with
 *   its `details.methods` and its French title.
 * - A session that ended since its introspection, or an account identity-service no longer finds,
 *   answers `401 auth.session-expired`.
 * - Passwords and codes travel in the body only and are never logged.
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

  /**
   * Property passwords
   *
   * @description
   * Changes the password of the account.
   *
   * @type {ChangePassword}
   * @readonly
   */
  private readonly passwords: ChangePassword;

  /**
   * Property emailChanges
   *
   * @description
   * Asks for a change of address.
   *
   * @type {RequestEmailChange}
   * @readonly
   */
  private readonly emailChanges: RequestEmailChange;

  /**
   * Property emailConfirmations
   *
   * @description
   * Confirms the new address with its code.
   *
   * @type {ConfirmEmailChange}
   * @readonly
   */
  private readonly emailConfirmations: ConfirmEmailChange;

  /**
   * Property deletions
   *
   * @description
   * Schedules the deletion of the account.
   *
   * @type {ScheduleAccountDeletion}
   * @readonly
   */
  private readonly deletions: ScheduleAccountDeletion;
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
   * @param {ChangePassword} passwords - Changes the password of the account.
   * @param {RequestEmailChange} emailChanges - Asks for a change of address.
   * @param {ConfirmEmailChange} emailConfirmations - Confirms the new address.
   * @param {ScheduleAccountDeletion} deletions - Schedules the deletion of the account.
   * @constructor
   */
  public constructor(
    @Inject(GetCurrentUser) users: GetCurrentUser,
    @Inject(UpdateCurrentUser) profiles: UpdateCurrentUser,
    @Inject(ChangePassword) passwords: ChangePassword,
    @Inject(RequestEmailChange) emailChanges: RequestEmailChange,
    @Inject(ConfirmEmailChange) emailConfirmations: ConfirmEmailChange,
    @Inject(ScheduleAccountDeletion) deletions: ScheduleAccountDeletion,
  ) {
    this.users = users;
    this.profiles = profiles;
    this.passwords = passwords;
    this.emailChanges = emailChanges;
    this.emailConfirmations = emailConfirmations;
    this.deletions = deletions;
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
   * Method changePassword
   *
   * @description
   * `PUT /v1/me/password`: replaces the password of the account; the other sessions stay open. The
   * right current password counts as a recent authentication of this session. `200` with the
   * account, its new `passwordChangedAt` and `ETag`.
   *
   * @param {z.output<typeof ChangePasswordBody>} body - Current and new passwords.
   * @param {Request} request - Request, for its verified session and its browser.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<CurrentUser>} The account after the change.
   */
  @Put('password')
  @CredentialGuard.requires({
    operationId: 'changePassword',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordBody)) body: z.output<typeof ChangePasswordBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUser> {
    const session: RequestSession = sessionOf(request);
    const user: GetCurrentUserOutput = await relaySessionUpstream(
      response,
      CHANGE_PASSWORD_PROBLEMS,
      () =>
        this.passwords.execute({
          userId: session.userId,
          sessionId: session.sessionId,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          client: browserClient(request),
        }),
      ENDED_SESSION,
    );
    return toCurrentUser(user);
  }

  /**
   * Method requestEmailChange
   *
   * @description
   * `POST /v1/me/email-change`: sends a code to the new address; the pending change belongs to
   * this session. `202`. Needs a recent authentication of the session
   * (`403 auth.reauthentication-required`).
   *
   * @param {z.output<typeof RequestEmailChangeBody>} body - The new address.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<EmailChangeCodeSent>} When the code expires and when another can be asked
   * for.
   */
  @Post('email-change')
  @HttpCode(202)
  @CredentialGuard.requires({
    operationId: 'requestEmailChange',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async requestEmailChange(
    @Body(new ZodValidationPipe(RequestEmailChangeBody))
    body: z.output<typeof RequestEmailChangeBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EmailChangeCodeSent> {
    const session: RequestSession = sessionOf(request);
    const sent: InternalEmailChangeCodeSent = await relaySessionUpstream(
      response,
      EMAIL_CHANGE_PROBLEMS,
      () =>
        this.emailChanges.execute({
          userId: session.userId,
          sessionId: session.sessionId,
          email: body.email,
        }),
      ENDED_SESSION,
    );
    return {
      email: sent.email,
      expiresAt: sent.expiresAt,
      resendAvailableAt: sent.resendAvailableAt,
    };
  }

  /**
   * Method confirmEmailChange
   *
   * @description
   * `POST /v1/me/email-change/confirmation`: checks the code sent to the new address and makes it
   * the address of the account. `200` with the account and `ETag`.
   *
   * @param {z.output<typeof ConfirmEmailChangeBody>} body - The code.
   * @param {Request} request - Request, for its verified session and its browser.
   * @param {Response} response - Response of the request.
   * @returns {Promise<CurrentUser>} The account with its new address.
   */
  @Post('email-change/confirmation')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'confirmEmailChange',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async confirmEmailChange(
    @Body(new ZodValidationPipe(ConfirmEmailChangeBody))
    body: z.output<typeof ConfirmEmailChangeBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUser> {
    const session: RequestSession = sessionOf(request);
    const user: GetCurrentUserOutput = await relaySessionUpstream(
      response,
      EMAIL_CHANGE_CONFIRMATION_PROBLEMS,
      () =>
        this.emailConfirmations.execute({
          userId: session.userId,
          sessionId: session.sessionId,
          code: body.code,
          client: browserClient(request),
        }),
      ENDED_SESSION,
    );
    return toCurrentUser(user);
  }

  /**
   * Method scheduleAccountDeletion
   *
   * @description
   * `POST /v1/me/deletion`: schedules the deletion of the account in 30 days. identity-service
   * revokes every session, this one included, and every personal API token at once, so the
   * gateway clears the session cookie on the `202`. A refusal leaves the cookie: the session is
   * still open.
   *
   * @param {z.output<typeof STRICT_DELETION_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response, for the cleared cookie.
   * @returns {Promise<DeletionScheduled>} When the account will be deleted.
   */
  @Post('deletion')
  @HttpCode(202)
  @CredentialGuard.requires({
    operationId: 'scheduleAccountDeletion',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async scheduleAccountDeletion(
    @Body(new ZodValidationPipe(STRICT_DELETION_BODY)) _body: z.output<typeof STRICT_DELETION_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeletionScheduled> {
    const session: RequestSession = sessionOf(request);
    const scheduled: InternalDeletionScheduled = await relaySessionUpstream(
      response,
      DELETION_PROBLEMS,
      () => this.deletions.execute({ userId: session.userId, sessionId: session.sessionId }),
      ENDED_SESSION,
    );
    response.setHeader('Set-Cookie', CLEARED_SESSION_COOKIE);
    return { deleteAt: scheduled.deleteAt };
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
      return sessionExpiredProblem(error);
    }
    return toPublicProblem(error, accepted);
  }
  // #endregion
}
