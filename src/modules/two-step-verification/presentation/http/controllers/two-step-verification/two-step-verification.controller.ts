import type {
  AuthenticatorAppConfigured,
  AuthenticatorAppSetup,
  BackupCodes,
  SecurityKey,
  SecurityKeyRegistration,
  TwoStepVerification,
} from '@cadenway/contracts/types/public/auth';
import {
  AddSecurityKeyBody,
  ConfirmAuthenticatorAppSetupBody,
  RegenerateBackupCodesBody,
  RemoveSecurityKeyParams,
  StartAuthenticatorAppSetupBody,
  StartSecurityKeyRegistrationBody,
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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { browserClient } from '../../../../../../presentation/http/mappers/browser-client.mapper.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import {
  relaySessionUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { AddSecurityKey } from '../../../../application/use-cases/commands/two-step/add-security-key/add-security-key.use-case.js';
import { ConfirmAuthenticatorAppSetup } from '../../../../application/use-cases/commands/two-step/confirm-authenticator-app-setup/confirm-authenticator-app-setup.use-case.js';
import { DisableTwoStepVerification } from '../../../../application/use-cases/commands/two-step/disable-two-step-verification/disable-two-step-verification.use-case.js';
import { RegenerateBackupCodes } from '../../../../application/use-cases/commands/two-step/regenerate-backup-codes/regenerate-backup-codes.use-case.js';
import { RemoveSecurityKey } from '../../../../application/use-cases/commands/two-step/remove-security-key/remove-security-key.use-case.js';
import { StartAuthenticatorAppSetup } from '../../../../application/use-cases/commands/two-step/start-authenticator-app-setup/start-authenticator-app-setup.use-case.js';
import { StartSecurityKeyRegistration } from '../../../../application/use-cases/commands/two-step/start-security-key-registration/start-security-key-registration.use-case.js';
import { GetTwoStepVerification } from '../../../../application/use-cases/queries/two-step/get-two-step-verification/get-two-step-verification.use-case.js';
import type { SecurityKey as InternalSecurityKey } from '../../../../application/models/two-step/security-key.model.js';
import {
  toAuthenticatorAppConfigured,
  toAuthenticatorAppSetup,
  toBackupCodes,
  toSecurityKey,
  toSecurityKeyRegistration,
  toTwoStepVerification,
} from '../../mappers/two-step-verification/two-step-verification.mapper.js';

/**
 * Constant INVALID_REQUEST
 *
 * @description
 * The `400` of the routes whose body comes from the browser (the confirmation code, the name and
 * the answer of a key), relayed when identity-service refuses a member.
 *
 * @type {readonly string[]}
 */
const INVALID_REQUEST: readonly string[] = ['request.invalid'];

/**
 * Constant REAUTHENTICATION_REQUIRED
 *
 * @description
 * The `403` of the routes that start or remove something without a recent authentication of the
 * session, with `details.methods`; relayed with its French title.
 *
 * @type {readonly string[]}
 */
const REAUTHENTICATION_REQUIRED: readonly string[] = ['auth.reauthentication-required'];

/**
 * Constant KEY_NOT_ADDABLE
 *
 * @description
 * The `409` of a security key that cannot be added (`SecurityKeyNotAddable`): two-step
 * verification is off, or the account has 10 keys.
 *
 * @type {readonly string[]}
 */
const KEY_NOT_ADDABLE: readonly string[] = [
  'auth.two-step-not-enabled',
  'auth.security-key-limit-reached',
];

/**
 * Constant READ_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `GET /v1/me/two-step-verification` answers as they are:
 * none, the call has neither a body nor a query.
 *
 * @type {AcceptedProblems}
 */
const READ_PROBLEMS: AcceptedProblems = {};

/**
 * Constant DISABLE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `DELETE /v1/me/two-step-verification` answers as they
 * are, in the order identity-service checks them: a policy that requires it
 * (`409 auth.mfa-required-by-organization`, `details.organizationIds`), then the recent
 * authentication. The internal body holds only the introspected session and the browser, so an
 * internal `400` is a defect, answered `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const DISABLE_PROBLEMS: AcceptedProblems = {
  403: REAUTHENTICATION_REQUIRED,
  409: ['auth.mfa-required-by-organization'],
};

/**
 * Constant SETUP_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST .../authenticator-app/setup` answers as they are:
 * the recent authentication only.
 *
 * @type {AcceptedProblems}
 */
const SETUP_PROBLEMS: AcceptedProblems = { 403: REAUTHENTICATION_REQUIRED };

/**
 * Constant CONFIRMATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST .../authenticator-app/setup/confirmation` answers
 * as they are (`SetupCodeRefused`). No recent authentication: the start required it.
 *
 * @type {AcceptedProblems}
 */
const CONFIRMATION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: ['auth.two-step-setup-expired', 'auth.two-step-code-invalid'],
};

/**
 * Constant REGENERATE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST .../backup-codes/regenerate` answers as they are:
 * two-step verification off, then the recent authentication.
 *
 * @type {AcceptedProblems}
 */
const REGENERATE_PROBLEMS: AcceptedProblems = {
  403: REAUTHENTICATION_REQUIRED,
  409: ['auth.two-step-not-enabled'],
};

/**
 * Constant REGISTRATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST .../security-keys/registration` answers as they
 * are: a key that cannot be added, then the recent authentication.
 *
 * @type {AcceptedProblems}
 */
const REGISTRATION_PROBLEMS: AcceptedProblems = {
  403: REAUTHENTICATION_REQUIRED,
  409: KEY_NOT_ADDABLE,
};

/**
 * Constant ADDITION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST .../security-keys` answers as they are
 * (`SecurityKeyNotAddable`, `SecurityKeyRegistrationRefused`). No recent authentication: the
 * registration required it.
 *
 * @type {AcceptedProblems}
 */
const ADDITION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  409: KEY_NOT_ADDABLE,
  422: ['auth.two-step-setup-expired', 'auth.security-key-refused'],
};

/**
 * Constant REMOVAL_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `DELETE .../security-keys/{securityKeyId}` answers as
 * they are: a key of another account, unknown or removed (`404 security-key.not-found`), then
 * the recent authentication. The id of the path is checked as a UUID before the call.
 *
 * @type {AcceptedProblems}
 */
const REMOVAL_PROBLEMS: AcceptedProblems = {
  403: REAUTHENTICATION_REQUIRED,
  404: ['security-key.not-found'],
};

/**
 * Constant ENDED_SESSION
 *
 * @description
 * The internal `404` codes that end the session for the applications (`401 auth.session-expired`):
 * the session of the request is no longer an open session of the user (`session.not-found`), or
 * the account can no longer be read (`user.not-found`). The public routes declare no such `404`.
 *
 * @type {readonly string[]}
 */
const ENDED_SESSION: readonly string[] = ['session.not-found', 'user.not-found'];

/**
 * Constant STRICT_SETUP_BODY
 *
 * @description
 * Validator of the body of the start of a setup: an empty object, with no other member
 * (`additionalProperties: false` of `EmptyRequest`, which the generated validator does not
 * enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const STRICT_SETUP_BODY: z.ZodType<Record<string, never>> = StartAuthenticatorAppSetupBody.strict();

/**
 * Constant STRICT_REGENERATE_BODY
 *
 * @description
 * Validator of the body of the regeneration of the backup codes: an empty object only.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const STRICT_REGENERATE_BODY: z.ZodType<Record<string, never>> = RegenerateBackupCodesBody.strict();

/**
 * Constant STRICT_REGISTRATION_BODY
 *
 * @description
 * Validator of the body of the start of a key registration: an empty object only.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const STRICT_REGISTRATION_BODY: z.ZodType<Record<string, never>> =
  StartSecurityKeyRegistrationBody.strict();

/**
 * Constant SECURITY_KEYS_PATH
 *
 * @description
 * Public path of the security keys, for the `Location` of a key added.
 *
 * @type {string}
 */
const SECURITY_KEYS_PATH: string = '/v1/me/two-step-verification/security-keys';

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
    throw new Error('A route of /v1/me/two-step-verification ran without a verified session.');
  }
  return session;
}

/**
 * Class TwoStepVerificationController
 *
 * @description
 * The routes of the tag `two-step-verification` of `openapi/public/auth.yaml`, under
 * `/v1/me/two-step-verification`: read the two-step verification of the account, turn it off,
 * set up or reconfigure the authenticator app, generate new backup codes, and register or remove a
 * security key.
 *
 * - Session only: `CredentialGuard` introspects the cookie first (`401 auth.session-required`,
 *   `401 auth.session-expired`), answers a personal API token `403 auth.api-token-not-accepted`
 *   and an unsafe request without an allowed `Origin` (and `Content-Type: application/json` for
 *   a body) `403 auth.csrf-rejected`; `RateLimitGuard` counts the session. No route needs an
 *   organization: a person whose organization is withheld for want of two-step verification sets
 *   it up here.
 * - Every call is made as the user and for the session the introspection returned, never ids the
 *   request names, with the browser of the request in `client` for the security emails.
 * - identity-service checks the recent authentication; its `403 auth.reauthentication-required` is
 *   relayed with `details.methods`. `404 session.not-found` and `404 user.not-found` mean the
 *   session ended after its introspection: `401 auth.session-expired`.
 * - The TOTP secret, its URI and the backup codes reach the browser once, in the answer of the
 *   route that creates them; like the codes and the WebAuthn answers the browser sends, they are
 *   never logged. Every answer carries `Cache-Control: no-store` (see `TwoStepVerificationModule`).
 */
@Controller('v1/me/two-step-verification')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TwoStepVerificationController {
  // #region Properties
  /**
   * Property reading
   *
   * @description
   * Reads the two-step verification.
   *
   * @type {GetTwoStepVerification}
   * @readonly
   */
  private readonly reading: GetTwoStepVerification;

  /**
   * Property disabling
   *
   * @description
   * Turns two-step verification off.
   *
   * @type {DisableTwoStepVerification}
   * @readonly
   */
  private readonly disabling: DisableTwoStepVerification;

  /**
   * Property setup
   *
   * @description
   * Starts the setup of an authenticator app.
   *
   * @type {StartAuthenticatorAppSetup}
   * @readonly
   */
  private readonly setup: StartAuthenticatorAppSetup;

  /**
   * Property confirmation
   *
   * @description
   * Confirms the authenticator app.
   *
   * @type {ConfirmAuthenticatorAppSetup}
   * @readonly
   */
  private readonly confirmation: ConfirmAuthenticatorAppSetup;

  /**
   * Property regeneration
   *
   * @description
   * Generates new backup codes.
   *
   * @type {RegenerateBackupCodes}
   * @readonly
   */
  private readonly regeneration: RegenerateBackupCodes;

  /**
   * Property registration
   *
   * @description
   * Starts the registration of a security key.
   *
   * @type {StartSecurityKeyRegistration}
   * @readonly
   */
  private readonly registration: StartSecurityKeyRegistration;

  /**
   * Property addition
   *
   * @description
   * Registers a security key.
   *
   * @type {AddSecurityKey}
   * @readonly
   */
  private readonly addition: AddSecurityKey;

  /**
   * Property removal
   *
   * @description
   * Removes a security key.
   *
   * @type {RemoveSecurityKey}
   * @readonly
   */
  private readonly removal: RemoveSecurityKey;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the two-step verification routes.
   *
   * @param {GetTwoStepVerification} reading - Reads the two-step verification.
   * @param {DisableTwoStepVerification} disabling - Turns it off.
   * @param {StartAuthenticatorAppSetup} setup - Starts the setup of an app.
   * @param {ConfirmAuthenticatorAppSetup} confirmation - Confirms the app.
   * @param {RegenerateBackupCodes} regeneration - Generates new backup codes.
   * @param {StartSecurityKeyRegistration} registration - Starts the registration of a key.
   * @param {AddSecurityKey} addition - Registers a key.
   * @param {RemoveSecurityKey} removal - Removes a key.
   * @constructor
   */
  public constructor(
    @Inject(GetTwoStepVerification) reading: GetTwoStepVerification,
    @Inject(DisableTwoStepVerification) disabling: DisableTwoStepVerification,
    @Inject(StartAuthenticatorAppSetup) setup: StartAuthenticatorAppSetup,
    @Inject(ConfirmAuthenticatorAppSetup) confirmation: ConfirmAuthenticatorAppSetup,
    @Inject(RegenerateBackupCodes) regeneration: RegenerateBackupCodes,
    @Inject(StartSecurityKeyRegistration) registration: StartSecurityKeyRegistration,
    @Inject(AddSecurityKey) addition: AddSecurityKey,
    @Inject(RemoveSecurityKey) removal: RemoveSecurityKey,
  ) {
    this.reading = reading;
    this.disabling = disabling;
    this.setup = setup;
    this.confirmation = confirmation;
    this.regeneration = regeneration;
    this.registration = registration;
    this.addition = addition;
    this.removal = removal;
  }
  // #endregion

  // #region Methods
  /**
   * Method getTwoStepVerification
   *
   * @description
   * `GET /v1/me/two-step-verification`: the card "Vérification en deux étapes" of the account,
   * without any secret.
   *
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<TwoStepVerification>} The two-step verification.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'getTwoStepVerification',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async getTwoStepVerification(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TwoStepVerification> {
    const session: RequestSession = sessionOf(request);
    return toTwoStepVerification(
      await relaySessionUpstream(
        response,
        READ_PROBLEMS,
        () => this.reading.execute({ userId: session.userId, sessionId: session.sessionId }),
        ENDED_SESSION,
      ),
    );
  }

  /**
   * Method disableTwoStepVerification
   *
   * @description
   * `DELETE /v1/me/two-step-verification`: turns two-step verification off, `204`, also when it
   * is off already. Refused while a policy of an organization of the person requires it, then
   * without a recent authentication.
   *
   * @param {Request} request - Request, for its verified session and the browser.
   * @param {Response} response - Response of the request.
   * @returns {Promise<void>} Resolves once it is off.
   */
  @Delete()
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'disableTwoStepVerification',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async disableTwoStepVerification(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const session: RequestSession = sessionOf(request);
    await relaySessionUpstream(
      response,
      DISABLE_PROBLEMS,
      () =>
        this.disabling.execute({
          userId: session.userId,
          sessionId: session.sessionId,
          client: browserClient(request),
        }),
      ENDED_SESSION,
    );
  }

  /**
   * Method startAuthenticatorAppSetup
   *
   * @description
   * `POST /v1/me/two-step-verification/authenticator-app/setup`: a new secret for an app, returned
   * once, pending for this session for 15 minutes. Needs a recent authentication.
   *
   * @param {z.output<typeof STRICT_SETUP_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<AuthenticatorAppSetup>} The secret and its `otpauth://` URI.
   */
  @Post('authenticator-app/setup')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'startAuthenticatorAppSetup',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async startAuthenticatorAppSetup(
    @Body(new ZodValidationPipe(STRICT_SETUP_BODY)) _body: z.output<typeof STRICT_SETUP_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatorAppSetup> {
    const session: RequestSession = sessionOf(request);
    return toAuthenticatorAppSetup(
      await relaySessionUpstream(
        response,
        SETUP_PROBLEMS,
        () => this.setup.execute({ userId: session.userId, sessionId: session.sessionId }),
        ENDED_SESSION,
      ),
    );
  }

  /**
   * Method confirmAuthenticatorAppSetup
   *
   * @description
   * `POST /v1/me/two-step-verification/authenticator-app/setup/confirmation`: confirms the pending
   * setup of this session with a code of the new app. `200`, with the 10 backup codes when
   * two-step verification turned on.
   *
   * @param {z.output<typeof ConfirmAuthenticatorAppSetupBody>} body - The code.
   * @param {Request} request - Request, for its verified session and the browser.
   * @param {Response} response - Response of the request.
   * @returns {Promise<AuthenticatorAppConfigured>} The two-step verification after the change.
   */
  @Post('authenticator-app/setup/confirmation')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'confirmAuthenticatorAppSetup',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async confirmAuthenticatorAppSetup(
    @Body(new ZodValidationPipe(ConfirmAuthenticatorAppSetupBody))
    body: z.output<typeof ConfirmAuthenticatorAppSetupBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatorAppConfigured> {
    const session: RequestSession = sessionOf(request);
    return toAuthenticatorAppConfigured(
      await relaySessionUpstream(
        response,
        CONFIRMATION_PROBLEMS,
        () =>
          this.confirmation.execute({
            userId: session.userId,
            sessionId: session.sessionId,
            code: body.code,
            client: browserClient(request),
          }),
        ENDED_SESSION,
      ),
    );
  }

  /**
   * Method regenerateBackupCodes
   *
   * @description
   * `POST /v1/me/two-step-verification/backup-codes/regenerate`: 10 new backup codes, returned
   * once; the previous ones stop working. Needs two-step verification on and a recent
   * authentication.
   *
   * @param {z.output<typeof STRICT_REGENERATE_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session and the browser.
   * @param {Response} response - Response of the request.
   * @returns {Promise<BackupCodes>} The new codes.
   */
  @Post('backup-codes/regenerate')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'regenerateBackupCodes',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async regenerateBackupCodes(
    @Body(new ZodValidationPipe(STRICT_REGENERATE_BODY))
    _body: z.output<typeof STRICT_REGENERATE_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BackupCodes> {
    const session: RequestSession = sessionOf(request);
    return toBackupCodes(
      await relaySessionUpstream(
        response,
        REGENERATE_PROBLEMS,
        () =>
          this.regeneration.execute({
            userId: session.userId,
            sessionId: session.sessionId,
            client: browserClient(request),
          }),
        ENDED_SESSION,
      ),
    );
  }

  /**
   * Method startSecurityKeyRegistration
   *
   * @description
   * `POST /v1/me/two-step-verification/security-keys/registration`: the WebAuthn creation options
   * of a new key, pending for this session for 5 minutes, passed on whole. Needs two-step
   * verification on, fewer than 10 keys and a recent authentication.
   *
   * @param {z.output<typeof STRICT_REGISTRATION_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<SecurityKeyRegistration>} The options for the browser.
   */
  @Post('security-keys/registration')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'startSecurityKeyRegistration',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async startSecurityKeyRegistration(
    @Body(new ZodValidationPipe(STRICT_REGISTRATION_BODY))
    _body: z.output<typeof STRICT_REGISTRATION_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityKeyRegistration> {
    const session: RequestSession = sessionOf(request);
    return toSecurityKeyRegistration(
      await relaySessionUpstream(
        response,
        REGISTRATION_PROBLEMS,
        () => this.registration.execute({ userId: session.userId, sessionId: session.sessionId }),
        ENDED_SESSION,
      ),
    );
  }

  /**
   * Method addSecurityKey
   *
   * @description
   * `POST /v1/me/two-step-verification/security-keys`: registers the key that answered the
   * pending registration of this session, under its name. `201` with the `Location` of the key,
   * where it is removed.
   *
   * @param {z.output<typeof AddSecurityKeyBody>} body - Name and answer of the browser.
   * @param {Request} request - Request, for its verified session and the browser.
   * @param {Response} response - Response, for `Location`.
   * @returns {Promise<SecurityKey>} The key registered.
   */
  @Post('security-keys')
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'addSecurityKey',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async addSecurityKey(
    @Body(new ZodValidationPipe(AddSecurityKeyBody)) body: z.output<typeof AddSecurityKeyBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityKey> {
    const session: RequestSession = sessionOf(request);
    const key: InternalSecurityKey = await relaySessionUpstream(
      response,
      ADDITION_PROBLEMS,
      () =>
        this.addition.execute({
          userId: session.userId,
          sessionId: session.sessionId,
          name: body.name,
          credential: body.credential,
          client: browserClient(request),
        }),
      ENDED_SESSION,
    );
    response.setHeader('Location', `${SECURITY_KEYS_PATH}/${key.id}`);
    return toSecurityKey(key);
  }

  /**
   * Method removeSecurityKey
   *
   * @description
   * `DELETE /v1/me/two-step-verification/security-keys/{securityKeyId}`: removes a key of the
   * account, `204`. A key of another account, unknown or removed answers
   * `404 security-key.not-found`; then a recent authentication is required.
   *
   * @param {z.output<typeof RemoveSecurityKeyParams>} params - The id of the key.
   * @param {Request} request - Request, for its verified session and the browser.
   * @param {Response} response - Response of the request.
   * @returns {Promise<void>} Resolves once the key is removed.
   */
  @Delete('security-keys/:securityKeyId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'removeSecurityKey',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async removeSecurityKey(
    @Param(new ZodValidationPipe(RemoveSecurityKeyParams))
    params: z.output<typeof RemoveSecurityKeyParams>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const session: RequestSession = sessionOf(request);
    await relaySessionUpstream(
      response,
      REMOVAL_PROBLEMS,
      () =>
        this.removal.execute({
          userId: session.userId,
          sessionId: session.sessionId,
          securityKeyId: params.securityKeyId,
          client: browserClient(request),
        }),
      ENDED_SESSION,
    );
  }
  // #endregion
}
