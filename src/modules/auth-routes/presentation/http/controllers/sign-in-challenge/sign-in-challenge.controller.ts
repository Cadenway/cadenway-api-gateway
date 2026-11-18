import type {
  SecurityKeyAssertionOptions,
  SignInChallenge,
  SignedIn,
} from '@cadenway/contracts/types/public/auth';
import {
  AnswerSignInChallengeWithAuthenticatorAppBody,
  AnswerSignInChallengeWithBackupCodeBody,
  AnswerSignInChallengeWithSecurityKeyBody,
  GetSignInChallengeSecurityKeyOptionsBody,
  InspectSignInChallengeBody,
} from '@cadenway/contracts/validators/public/auth';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { CsrfGuard } from '../../../../../auth/public/session/csrf-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { browserClient } from '../../../../../../presentation/http/mappers/browser-client.mapper.js';
import { sessionCookieHeader } from '../../../../../../presentation/http/session/session-cookie.js';
import { trustedDeviceCookieHeader } from '../../../../../../presentation/http/session/trusted-device-cookie.js';
import {
  relayUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import type { SessionIssued } from '../../../../application/models/auth/session-issued.model.js';
import { AnswerSignInChallengeWithAuthenticatorApp } from '../../../../application/use-cases/commands/auth/answer-sign-in-challenge-with-authenticator-app/answer-sign-in-challenge-with-authenticator-app.use-case.js';
import { AnswerSignInChallengeWithBackupCode } from '../../../../application/use-cases/commands/auth/answer-sign-in-challenge-with-backup-code/answer-sign-in-challenge-with-backup-code.use-case.js';
import { AnswerSignInChallengeWithSecurityKey } from '../../../../application/use-cases/commands/auth/answer-sign-in-challenge-with-security-key/answer-sign-in-challenge-with-security-key.use-case.js';
import { GetSignInChallengeSecurityKeyOptions } from '../../../../application/use-cases/commands/auth/get-sign-in-challenge-security-key-options/get-sign-in-challenge-security-key-options.use-case.js';
import { InspectSignInChallenge } from '../../../../application/use-cases/queries/auth/inspect-sign-in-challenge/inspect-sign-in-challenge.use-case.js';
import {
  toSecurityKeyAssertionOptions,
  toSignedIn,
  toSignInChallenge,
} from '../../mappers/auth/sign-in.mapper.js';

/**
 * Constant INVALID_REQUEST
 *
 * @description
 * The `400` every route of this controller declares: the body comes from the browser.
 *
 * @type {readonly string[]}
 */
const INVALID_REQUEST: readonly string[] = ['request.invalid'];

/**
 * Constant CHALLENGE_EXPIRED
 *
 * @description
 * The `422` of a challenge that expired, was answered, was replaced, or is unknown or malformed
 * (`ChallengeExpired`), checked by identity-service before anything else.
 *
 * @type {string}
 */
const CHALLENGE_EXPIRED: string = 'auth.challenge-expired';

/**
 * Constant TWO_STEP_LOCKED
 *
 * @description
 * The `429` of the lockout of the two-step answers of the account (`TwoStepLocked`), with
 * `Retry-After` derived from `details.lockedUntil`.
 *
 * @type {readonly string[]}
 */
const TWO_STEP_LOCKED: readonly string[] = ['auth.two-step-locked'];

/**
 * Constant INSPECTION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-in/challenge/inspection` answers as
 * they are.
 *
 * @type {AcceptedProblems}
 */
const INSPECTION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: [CHALLENGE_EXPIRED],
};

/**
 * Constant CODE_ANSWER_PROBLEMS
 *
 * @description
 * Client errors of identity-service that the answers by a code of the app or by a backup code
 * answer as they are (`TwoStepCodeRefused`, `TwoStepLocked`).
 *
 * @type {AcceptedProblems}
 */
const CODE_ANSWER_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: [CHALLENGE_EXPIRED, 'auth.two-step-code-invalid'],
  429: TWO_STEP_LOCKED,
};

/**
 * Constant SECURITY_KEY_PROBLEMS
 *
 * @description
 * Client errors of identity-service that the options and the answer of a security key answer as
 * they are (`SecurityKeyAnswerRefused`, `TwoStepLocked`).
 *
 * @type {AcceptedProblems}
 */
const SECURITY_KEY_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: [CHALLENGE_EXPIRED, 'auth.security-key-refused'],
  429: TWO_STEP_LOCKED,
};

/**
 * Class SignInChallengeController
 *
 * @description
 * The routes of `openapi/public/auth.yaml` under `/v1/auth/sign-in/challenge`: reading a two-step
 * challenge again, and answering it with a code of the authenticator app, a backup code or a
 * security key (after its WebAuthn options).
 *
 * - Every route is `POST`, carries no session (`security: []`) and passes `CsrfGuard` first, as
 *   the sign-ins do; `CredentialGuard` reads neither the cookie nor a bearer token, and
 *   `RateLimitGuard` counts each request on the client address (60 per minute), so the answers of
 *   a challenge are limited per address on top of the lockout of identity-service. Every answer
 *   carries `Cache-Control: no-store` (see `AuthRoutesModule`).
 * - The challenge token, the codes and the answer of the key travel to identity-service in the
 *   body only, as the actor `anonymous`, and are never logged.
 * - A right answer signs in as a `200` sign-in does: `__Host-cw_session` from the session token,
 *   and, when the answer asked for `trustDevice` and identity-service returned a trusted device,
 *   `__Host-cw_trusted_device` with exactly the attributes of the contract. Neither token reaches
 *   the body.
 * - A client error of identity-service is answered as the public problem of its code when the
 *   public operation declares it, with `Retry-After` for `429 auth.two-step-locked`; any other
 *   answer is `503 upstream.*` (see `relayUpstream`).
 */
@Controller('v1/auth/sign-in/challenge')
@UseGuards(CsrfGuard, CredentialGuard, RateLimitGuard)
export class SignInChallengeController {
  // #region Properties
  /**
   * Property inspection
   *
   * @description
   * Reads a challenge again.
   *
   * @type {InspectSignInChallenge}
   * @readonly
   */
  private readonly inspection: InspectSignInChallenge;

  /**
   * Property authenticatorApp
   *
   * @description
   * Answers a challenge with a code of the authenticator app.
   *
   * @type {AnswerSignInChallengeWithAuthenticatorApp}
   * @readonly
   */
  private readonly authenticatorApp: AnswerSignInChallengeWithAuthenticatorApp;

  /**
   * Property backupCode
   *
   * @description
   * Answers a challenge with a backup code.
   *
   * @type {AnswerSignInChallengeWithBackupCode}
   * @readonly
   */
  private readonly backupCode: AnswerSignInChallengeWithBackupCode;

  /**
   * Property securityKeyOptions
   *
   * @description
   * Issues the WebAuthn options of a challenge.
   *
   * @type {GetSignInChallengeSecurityKeyOptions}
   * @readonly
   */
  private readonly securityKeyOptions: GetSignInChallengeSecurityKeyOptions;

  /**
   * Property securityKey
   *
   * @description
   * Answers a challenge with a security key.
   *
   * @type {AnswerSignInChallengeWithSecurityKey}
   * @readonly
   */
  private readonly securityKey: AnswerSignInChallengeWithSecurityKey;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the two-step challenge.
   *
   * @param {InspectSignInChallenge} inspection - Reads a challenge again.
   * @param {AnswerSignInChallengeWithAuthenticatorApp} authenticatorApp - Answers with a code of
   * the app.
   * @param {AnswerSignInChallengeWithBackupCode} backupCode - Answers with a backup code.
   * @param {GetSignInChallengeSecurityKeyOptions} securityKeyOptions - Issues the WebAuthn options.
   * @param {AnswerSignInChallengeWithSecurityKey} securityKey - Answers with a security key.
   * @constructor
   */
  public constructor(
    @Inject(InspectSignInChallenge) inspection: InspectSignInChallenge,
    @Inject(AnswerSignInChallengeWithAuthenticatorApp)
    authenticatorApp: AnswerSignInChallengeWithAuthenticatorApp,
    @Inject(AnswerSignInChallengeWithBackupCode) backupCode: AnswerSignInChallengeWithBackupCode,
    @Inject(GetSignInChallengeSecurityKeyOptions)
    securityKeyOptions: GetSignInChallengeSecurityKeyOptions,
    @Inject(AnswerSignInChallengeWithSecurityKey) securityKey: AnswerSignInChallengeWithSecurityKey,
  ) {
    this.inspection = inspection;
    this.authenticatorApp = authenticatorApp;
    this.backupCode = backupCode;
    this.securityKeyOptions = securityKeyOptions;
    this.securityKey = securityKey;
  }
  // #endregion

  // #region Methods
  /**
   * Method inspectSignInChallenge
   *
   * @description
   * `POST /v1/auth/sign-in/challenge/inspection`: the challenge as the `202` of the sign-in gave
   * it, without answering it. `200`, or `422 auth.challenge-expired`.
   *
   * @param {z.output<typeof InspectSignInChallengeBody>} body - The token of the challenge.
   * @param {Response} response - Response of the request.
   * @returns {Promise<SignInChallenge>} The challenge.
   */
  @Post('inspection')
  @CredentialGuard.requires({
    operationId: 'inspectSignInChallenge',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async inspectSignInChallenge(
    @Body(new ZodValidationPipe(InspectSignInChallengeBody))
    body: z.output<typeof InspectSignInChallengeBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInChallenge> {
    return toSignInChallenge(
      await relayUpstream(response, INSPECTION_PROBLEMS, () =>
        this.inspection.execute({ token: body.token }),
      ),
    );
  }

  /**
   * Method answerWithAuthenticatorApp
   *
   * @description
   * `POST /v1/auth/sign-in/challenge/authenticator-app`: answers the challenge with the 6 digits
   * of the app. `200` with the session cookie, and the device cookie with `trustDevice`.
   *
   * @param {z.output<typeof AnswerSignInChallengeWithAuthenticatorAppBody>} body - Token, code and
   * `trustDevice`.
   * @param {Request} request - Request, for the browser's address and User-Agent.
   * @param {Response} response - Response, for the cookies and `Retry-After`.
   * @returns {Promise<SignedIn>} The user and the session.
   */
  @Post('authenticator-app')
  @CredentialGuard.requires({
    operationId: 'answerSignInChallengeWithAuthenticatorApp',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async answerWithAuthenticatorApp(
    @Body(new ZodValidationPipe(AnswerSignInChallengeWithAuthenticatorAppBody))
    body: z.output<typeof AnswerSignInChallengeWithAuthenticatorAppBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn> {
    const issued: SessionIssued = await relayUpstream(response, CODE_ANSWER_PROBLEMS, () =>
      this.authenticatorApp.execute({
        token: body.token,
        code: body.code,
        trustDevice: body.trustDevice,
        client: browserClient(request),
      }),
    );
    return this.signIn(response, issued, body.trustDevice);
  }

  /**
   * Method answerWithBackupCode
   *
   * @description
   * `POST /v1/auth/sign-in/challenge/backup-code`: answers the challenge with a backup code, which
   * works once. `200` with the session cookie, and the device cookie with `trustDevice`.
   *
   * @param {z.output<typeof AnswerSignInChallengeWithBackupCodeBody>} body - Token, backup code
   * and `trustDevice`.
   * @param {Request} request - Request, for the browser's address and User-Agent.
   * @param {Response} response - Response, for the cookies and `Retry-After`.
   * @returns {Promise<SignedIn>} The user and the session.
   */
  @Post('backup-code')
  @CredentialGuard.requires({
    operationId: 'answerSignInChallengeWithBackupCode',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async answerWithBackupCode(
    @Body(new ZodValidationPipe(AnswerSignInChallengeWithBackupCodeBody))
    body: z.output<typeof AnswerSignInChallengeWithBackupCodeBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn> {
    const issued: SessionIssued = await relayUpstream(response, CODE_ANSWER_PROBLEMS, () =>
      this.backupCode.execute({
        token: body.token,
        code: body.code,
        trustDevice: body.trustDevice,
        client: browserClient(request),
      }),
    );
    return this.signIn(response, issued, body.trustDevice);
  }

  /**
   * Method getSecurityKeyOptions
   *
   * @description
   * `POST /v1/auth/sign-in/challenge/security-key/options`: new WebAuthn options for the keys of
   * the account, which replace the previous options of the challenge. `200`.
   *
   * @param {z.output<typeof GetSignInChallengeSecurityKeyOptionsBody>} body - The token of the
   * challenge.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<SecurityKeyAssertionOptions>} The options for the browser.
   */
  @Post('security-key/options')
  @CredentialGuard.requires({
    operationId: 'getSignInChallengeSecurityKeyOptions',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async getSecurityKeyOptions(
    @Body(new ZodValidationPipe(GetSignInChallengeSecurityKeyOptionsBody))
    body: z.output<typeof GetSignInChallengeSecurityKeyOptionsBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityKeyAssertionOptions> {
    return toSecurityKeyAssertionOptions(
      await relayUpstream(response, SECURITY_KEY_PROBLEMS, () =>
        this.securityKeyOptions.execute({ token: body.token }),
      ),
    );
  }

  /**
   * Method answerWithSecurityKey
   *
   * @description
   * `POST /v1/auth/sign-in/challenge/security-key`: answers the challenge with the answer of a
   * security key, passed to identity-service whole, members the contract does not list included.
   * `200` with the session cookie, and the device cookie with `trustDevice`.
   *
   * @param {z.output<typeof AnswerSignInChallengeWithSecurityKeyBody>} body - Token, answer of
   * the key and `trustDevice`.
   * @param {Request} request - Request, for the browser's address and User-Agent.
   * @param {Response} response - Response, for the cookies and `Retry-After`.
   * @returns {Promise<SignedIn>} The user and the session.
   */
  @Post('security-key')
  @CredentialGuard.requires({
    operationId: 'answerSignInChallengeWithSecurityKey',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async answerWithSecurityKey(
    @Body(new ZodValidationPipe(AnswerSignInChallengeWithSecurityKeyBody))
    body: z.output<typeof AnswerSignInChallengeWithSecurityKeyBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn> {
    const issued: SessionIssued = await relayUpstream(response, SECURITY_KEY_PROBLEMS, () =>
      this.securityKey.execute({
        token: body.token,
        credential: body.credential,
        trustDevice: body.trustDevice,
        client: browserClient(request),
      }),
    );
    return this.signIn(response, issued, body.trustDevice);
  }

  /**
   * Method signIn
   *
   * @description
   * Completes a right answer: sets the session cookie, and the device cookie when the answer
   * asked for `trustDevice` and identity-service returned a trusted device (a device token the
   * browser did not ask for is never written), then answers the user and the session. Both tokens
   * leave the gateway in their `Set-Cookie` only.
   *
   * @param {Response} response - Response of the request.
   * @param {SessionIssued} issued - Session opened by identity-service.
   * @param {boolean} trustDevice - `trustDevice` of the answer.
   * @returns {SignedIn} The public answer.
   */
  private signIn(response: Response, issued: SessionIssued, trustDevice: boolean): SignedIn {
    const cookies: string[] = [sessionCookieHeader(issued.token, issued.session, new Date())];
    if (trustDevice && issued.trustedDevice !== undefined) {
      cookies.push(trustedDeviceCookieHeader(issued.trustedDevice.token));
    }
    response.setHeader('Set-Cookie', cookies);
    return toSignedIn(issued);
  }
  // #endregion
}
