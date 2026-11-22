import type {
  ApiTokenCreated,
  ApiTokenCreation,
  ApiTokenPage,
  AuthenticationPolicy,
  AuthenticationPolicyPatch,
  AuthenticatorAppAnswer,
  AuthenticatorAppConfigured,
  AuthenticatorAppConfirmation,
  AuthenticatorAppSetup,
  BackupCodeAnswer,
  BackupCodes,
  ChallengeTokenRequest,
  CodeRequest,
  CodeSent,
  CodeVerification,
  CurrentAvatarReference,
  DeletionRequest,
  DeletionScheduled,
  EmailChangeCodeSent,
  EmailChangeConfirmation,
  EmailChangeRequest,
  FederatedFlowStarted,
  FederatedOAuthCallback,
  FederatedReceipt,
  FederatedSamlCallback,
  FederatedSignInFinish,
  FederatedSignInStart,
  ListApiTokensInternalParams,
  ListUserSessionsInternalParams,
  OpenSessionPage,
  PasswordChange,
  PasswordResetCompleted,
  PasswordResetConfirmation,
  PasswordResetLink,
  PasswordResetLinkSent,
  PasswordResetRequest,
  PasswordResetToken,
  PasswordSignIn,
  ProfilePatch,
  ProfileMediaReservation,
  ProfileMediaReservationState,
  ReauthenticationRequest,
  RecentAuthentication,
  RealtimeTicket,
  RevokedSessions,
  SecurityKey,
  SecurityKeyAddition,
  SecurityKeyAnswer,
  SecurityKeyAssertionOptions,
  SecurityKeyRegistration,
  SessionIssued,
  SessionOrganization,
  SessionReference,
  SignInChallenge,
  SignInMethods,
  SignInMethodsRequest,
  SignUpRequest,
  SignUpVerification,
  StartAvatarUpload,
  TwoStepChange,
  TwoStepVerification,
  User,
} from '@cadenway/contracts/types/internal/identity-service';
import {
  AddSecurityKeyInternalResponse,
  AnswerSignInChallengeWithAuthenticatorAppInternalResponse,
  AnswerSignInChallengeWithBackupCodeInternalResponse,
  AnswerSignInChallengeWithSecurityKeyInternalResponse,
  ChangePasswordInternalResponse,
  CompleteOAuthSignInInternalResponse,
  CompleteSamlSignInInternalResponse,
  ConfirmAuthenticatorAppSetupInternalResponse,
  ConfirmEmailChangeInternalResponse,
  ConfirmPasswordResetInternalResponse,
  CreateApiTokenInternalResponse,
  DiscoverSignInMethodsInternalResponse,
  FinishFederatedSignInInternalResponse,
  GetAuthenticationPolicyInternalResponse,
  GetAvatarReferenceInternalResponse,
  GetAvatarUploadStateInternalResponse,
  GetSignInChallengeSecurityKeyOptionsInternalResponse,
  GetTwoStepVerificationInternalResponse,
  GetUserResponse,
  InspectPasswordResetLinkInternalResponse,
  InspectSignInChallengeInternalResponse,
  IntrospectApiTokenResponse,
  IntrospectTokenResponse,
  IssueRealtimeTicketInternalResponse,
  ListApiTokensInternalResponse,
  ListUserSessionsInternalResponse,
  ReauthenticateInternalResponse,
  RegenerateBackupCodesInternalResponse,
  RequestEmailChangeInternalResponse,
  RequestPasswordResetInternalResponse,
  RequestSignInCodeInternalResponse,
  ResendSignUpCodeInternalResponse,
  ReserveAvatarUploadInternalResponse,
  RevokeOtherSessionsInternalResponse,
  ScheduleAccountDeletionInternalResponse,
  SignInWithCodeInternalResponse,
  SignInWithPasswordInternalResponse,
  SignUpInternalResponse,
  StartAuthenticatorAppSetupInternalResponse,
  StartFederatedSignInInternalResponse,
  StartSecurityKeyRegistrationInternalResponse,
  SwitchSessionOrganizationResponse,
  UpdateAuthenticationPolicyInternalResponse,
  UpdateUserResponse,
  VerifySignUpInternalResponse,
} from '@cadenway/contracts/validators/internal/identity-service';
import type {
  InternalActorType,
  InternalHttpClient,
  InternalRequestInit,
  InternalTokenClaims,
} from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';
import type { z } from 'zod';

import {
  answered as answeredBy,
  expectBody as expectBodyOf,
  expectStatus as expectStatusOf,
  outsideContract,
  type GeneratedResponse,
} from '../problems/upstream-answer.js';
import { getIdentityServiceInternalRoutes } from './generated/identity-service.js';

/**
 * Type IdentitySession
 *
 * @description
 * Validated fields returned for an active Identity session.
 *
 * @type {Omit<Extract<z.output<typeof IntrospectTokenResponse>, { active: true }>, "active" | "tokenType">}
 */
type IdentitySession = Omit<
  Extract<z.output<typeof IntrospectTokenResponse>, { active: true }>,
  'active' | 'tokenType'
>;

/**
 * Type IdentityApiToken
 *
 * @description
 * Validated fields returned for an active personal API token.
 *
 * @type {Omit<Extract<z.output<typeof IntrospectApiTokenResponse>, { active: true }>, "active" | "tokenType">}
 */
type IdentityApiToken = Omit<
  Extract<z.output<typeof IntrospectApiTokenResponse>, { active: true }>,
  'active' | 'tokenType'
>;

/**
 * Type IdentitySignIn
 *
 * @description
 * What a sign-in by password or by email code answers: `signed-in` with the session opened
 * (`200`), or `challenge` with the two-step challenge of an account with two-step verification
 * (`202`, no session and no token), validated with the validator of
 * `POST /internal/v1/auth/sign-in/challenge/inspection`, whose `200` has the schema of that `202`
 * (orval generates a response validator for the first success status only).
 *
 * @type {{ readonly outcome: 'signed-in'; readonly session: SessionIssued } | { readonly outcome: 'challenge'; readonly challenge: SignInChallenge }}
 */
export type IdentitySignIn =
  | { readonly outcome: 'signed-in'; readonly session: SessionIssued }
  | { readonly outcome: 'challenge'; readonly challenge: SignInChallenge };

/**
 * Constant IDENTITY_SERVICE
 *
 * @description
 * Name of identity-service: the `aud` of the internal tokens of its calls, the name of its circuit
 * breaker and the `details.service` of the problems its calls raise.
 *
 * @type {string}
 */
export const IDENTITY_SERVICE: string = 'identity-service';

/**
 * Constant SESSION_TOKEN_TYPE
 *
 * @description
 * `tokenType` of an active session token in the introspection of a cookie. Any other type is not
 * a session, and a cookie carrying one is not active.
 *
 * @type {string}
 */
const SESSION_TOKEN_TYPE: string = 'session';

/**
 * Constant API_TOKEN_TYPE
 *
 * @description
 * `tokenType` of an active personal API token in its introspection. Any other type is not a
 * personal token, and a bearer token carrying one is not active.
 *
 * @type {string}
 */
const API_TOKEN_TYPE: string = 'api-token';

/**
 * Constant NOT_RETRIED
 *
 * @description
 * Options of a call the internal HTTP client must not retry although its method is idempotent:
 * the claims stay those of the current organization context.
 *
 * @type {InternalRequestInit}
 */
const NOT_RETRIED: InternalRequestInit = { idempotent: false };

/**
 * Type IdentityServiceRoutes
 *
 * @description
 * The functions orval generated from `openapi/internal/identity-service.yaml`.
 *
 * @type {ReturnType<typeof getIdentityServiceInternalRoutes>}
 */
type IdentityServiceRoutes = ReturnType<typeof getIdentityServiceInternalRoutes>;

/**
 * Function callerClaims
 *
 * @description
 * Claims of a call the gateway makes outside any organization context: the sign-up and sign-in
 * flows, made for nobody yet (`anonymous`), and the introspection, made by the gateway as itself
 * (`system`). Neither carries an id, an organization, a role or a scope; both carry the trace id
 * of the request when there is one, as the claims built from a context do.
 *
 * @param {Extract<InternalActorType, 'anonymous' | 'system'>} actor - Actor of the call.
 * @returns {InternalRequestInit} The options that make the internal HTTP client sign these claims.
 */
function callerClaims(
  actor: Extract<InternalActorType, 'anonymous' | 'system'>,
): InternalRequestInit {
  const traceId: string | undefined = trace.getActiveSpan()?.spanContext().traceId;
  const claims: InternalTokenClaims = {
    actor: { type: actor, id: null },
    organizationId: null,
    role: null,
    scopes: [],
    ...(traceId === undefined ? {} : { traceId }),
  };
  return { claims };
}

/**
 * Function expectStatus
 *
 * @description
 * Checks that a response of identity-service has the success status of its operation.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedResponse} response - Response of the generated function.
 * @param {number} status - Success status of the operation.
 * @throws {ProblemException} 503 `upstream.failed` for another status.
 */
function expectStatus(operation: string, response: GeneratedResponse, status: number): void {
  expectStatusOf(IDENTITY_SERVICE, operation, response, status);
}

/**
 * Function expectBody
 *
 * @description
 * Checks a response of identity-service against its operation: the success status, then the body
 * against the zod validator of `@cadenway/contracts`, keeping the members of the contract only.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedResponse} response - Response of the generated function.
 * @param {number} status - Success status of the operation.
 * @param {TSchema} schema - Validator of the success body.
 * @returns {z.output<TSchema>} The validated body.
 * @throws {ProblemException} 503 `upstream.failed` when the status or the body does not match.
 */
function expectBody<TSchema extends z.ZodType>(
  operation: string,
  response: GeneratedResponse,
  status: number,
  schema: TSchema,
): z.output<TSchema> {
  return expectBodyOf(IDENTITY_SERVICE, operation, response, status, schema);
}

/**
 * Function answered
 *
 * @description
 * Awaits a generated call of identity-service: a body that is not JSON becomes
 * `503 upstream.failed` without being quoted, since it may hold a token.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {Promise<TResponse>} call - The generated call.
 * @returns {Promise<TResponse>} What the call resolved with.
 * @throws {ProblemException} 503 `upstream.failed` for a body that is not JSON.
 */
function answered<TResponse>(operation: string, call: Promise<TResponse>): Promise<TResponse> {
  return answeredBy(IDENTITY_SERVICE, operation, call);
}

/**
 * Function ifMatchHeader
 *
 * @description
 * The request options that relay the `If-Match` of the public request unchanged, or none.
 *
 * @param {string | undefined} ifMatch - `If-Match` of the public request.
 * @returns {RequestInit} The options of the generated call.
 */
function ifMatchHeader(ifMatch: string | undefined): RequestInit {
  return ifMatch === undefined ? {} : { headers: { 'If-Match': ifMatch } };
}

/** Checks the version header of a successful avatar mutation. */
function avatarEtag(
  operation: string,
  response: GeneratedResponse & { readonly headers: Headers },
): { etag: string } {
  expectStatus(operation, response, 204);
  const etag = response.headers.get('ETag');
  if (etag === null || !/^"[1-9][0-9]*"$/u.test(etag)) {
    throw outsideContract(IDENTITY_SERVICE, operation, 'no strong avatar ETag');
  }
  return { etag };
}

/**
 * Function signInOf
 *
 * @description
 * Reads the answer of a sign-in by password or by email code: a `202` is the two-step challenge,
 * checked against `InspectSignInChallengeInternalResponse`; any other status must be the `200` of
 * the operation, checked against its own validator. The challenge carries no session token, and
 * the answer of the `202` sets no cookie.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedResponse} response - Response of the generated function.
 * @param {z.ZodType<SessionIssued>} signedIn - Validator of the `200` of the operation.
 * @returns {IdentitySignIn} The session opened, or the challenge to answer.
 * @throws {ProblemException} 503 `upstream.failed` when the status or the body does not match.
 */
function signInOf(
  operation: string,
  response: GeneratedResponse,
  signedIn: z.ZodType<SessionIssued>,
): IdentitySignIn {
  if (response.status === 202) {
    return {
      outcome: 'challenge',
      challenge: expectBody(operation, response, 202, InspectSignInChallengeInternalResponse),
    };
  }
  return { outcome: 'signed-in', session: expectBody(operation, response, 200, signedIn) };
}

/**
 * Class IdentityServiceClient
 *
 * @description
 * Outgoing adapter of identity-service: the functions generated from
 * `openapi/internal/identity-service.yaml`, called through one `InternalHttpClient` of
 * `@cadenway/nest-common`, behind the ports of the session guard and of the routes.
 *
 * - Every call carries an internal token signed by the gateway with `aud: identity-service`: the
 *   actor `anonymous` for the sign-up, sign-in (its two-step challenge included) and password
 *   reset flows, `system` for the two
 *   introspections, and the user of the current organization context for every other call (with
 *   the organization of that context, which the personal API token routes and the authentication
 *   policy require).
 * - The internal HTTP client gives each call the time left to the request (2 seconds at most), one
 *   retry after a connection error or a `503` for an idempotent call (both introspections are
 *   declared idempotent by their contract, as `GET`, `PUT` and `DELETE` are, but the password
 *   change and avatar mutations; the flows and the other `POST` and `PATCH` calls are not retried),
 *   and the circuit breaker of identity-service. It throws its problems: a relayed client error, or
 *   `503 upstream.*`.
 * - Passwords, reset tokens, codes, backup codes, challenge and trusted device tokens and WebAuthn
 *   answers travel in the bodies only, never in a path, a query or a log line; the TOTP secret
 *   and the backup codes identity-service returns once are never logged either.
 * - Every success is checked against the internal contract before it is returned; a mismatch is
 *   `503 upstream.failed`.
 */
export class IdentityServiceClient {
  // #region Properties
  /**
   * Property routes
   *
   * @description
   * The generated functions, bound to the `fetch` of the internal HTTP client.
   *
   * @type {IdentityServiceRoutes}
   * @readonly
   */
  private readonly routes: IdentityServiceRoutes;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the generated functions to the internal HTTP client of identity-service. The generated
   * code passes the path of each route (`/internal/v1/...`) and its options, `claims` and
   * `idempotent` included, to that client, which resolves the path against
   * `IDENTITY_SERVICE_URL`.
   *
   * @param {InternalHttpClient} http - Internal HTTP client built for identity-service.
   * @constructor
   */
  public constructor(http: InternalHttpClient) {
    this.routes = getIdentityServiceInternalRoutes(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (typeof input !== 'string') {
          throw new Error('The generated identity-service client passes a path.');
        }
        return http.fetch(input, init);
      },
    );
  }
  // #endregion

  // #region Methods
  /** Issues a single-use credential for the current signed session without retrying. */
  public async issueRealtimeTicket(sessionId: string): Promise<RealtimeTicket> {
    const operation = 'issueRealtimeTicketInternal';
    const response = await answered(
      operation,
      this.routes.issueRealtimeTicketInternal({ sessionId }, NOT_RETRIED),
    );
    if (response.headers.get('Cache-Control')?.toLowerCase() !== 'no-store') {
      throw outsideContract(IDENTITY_SERVICE, operation, 'missing no-store');
    }
    return expectBody(operation, response, 200, IssueRealtimeTicketInternalResponse);
  }

  /**
   * Method introspect
   *
   * @description
   * `POST /internal/v1/tokens/introspect` as the actor `system`, retried once on a connection
   * error or a `503`: the contract makes the call idempotent.
   *
   * @param {string} token - Value of the session cookie. A secret: it travels in the body only.
   * @returns {Promise<IdentitySession | null>} The session, or `null` when the token is not an
   * active session token.
   */
  public async introspect(token: string): Promise<IdentitySession | null> {
    const options: InternalRequestInit = { ...callerClaims('system'), idempotent: true };
    const answer: z.output<typeof IntrospectTokenResponse> = expectBody(
      'introspectToken',
      await answered('introspectToken', this.routes.introspectToken({ token }, options)),
      200,
      IntrospectTokenResponse,
    );
    if (!answer.active || answer.tokenType !== SESSION_TOKEN_TYPE) {
      return null;
    }
    return {
      sessionId: answer.sessionId,
      userId: answer.userId,
      organizationId: answer.organizationId,
      role: answer.role,
      scopes: answer.scopes,
      expiresAt: answer.expiresAt,
      ...(answer.withheldOrganization === undefined
        ? {}
        : { withheldOrganization: answer.withheldOrganization }),
    };
  }

  /**
   * Method discoverSignInMethods
   *
   * @description
   * `POST /internal/v1/auth/sign-in-methods` as the actor `anonymous`.
   *
   * @param {SignInMethodsRequest} request - Address to discover the methods of.
   * @returns {Promise<SignInMethods>} The methods to offer.
   */
  public async discoverSignInMethods(request: SignInMethodsRequest): Promise<SignInMethods> {
    return expectBody(
      'discoverSignInMethodsInternal',
      await answered(
        'discoverSignInMethodsInternal',
        this.routes.discoverSignInMethodsInternal(request, callerClaims('anonymous')),
      ),
      200,
      DiscoverSignInMethodsInternalResponse,
    );
  }

  /**
   * Method signUp
   *
   * @description
   * `POST /internal/v1/auth/sign-up` as the actor `anonymous`.
   *
   * @param {SignUpRequest} request - Name, address, password and acceptance of the terms.
   * @returns {Promise<CodeSent>} When the code expires and when another can be asked for.
   */
  public async signUp(request: SignUpRequest): Promise<CodeSent> {
    return expectBody(
      'signUpInternal',
      await answered(
        'signUpInternal',
        this.routes.signUpInternal(request, callerClaims('anonymous')),
      ),
      202,
      SignUpInternalResponse,
    );
  }

  /**
   * Method resendSignUpCode
   *
   * @description
   * `POST /internal/v1/auth/sign-up/code` as the actor `anonymous`.
   *
   * @param {CodeRequest} request - Address awaiting a sign-up code.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was issued.
   */
  public async resendSignUpCode(request: CodeRequest): Promise<CodeSent> {
    return expectBody(
      'resendSignUpCodeInternal',
      await answered(
        'resendSignUpCodeInternal',
        this.routes.resendSignUpCodeInternal(request, callerClaims('anonymous')),
      ),
      202,
      ResendSignUpCodeInternalResponse,
    );
  }

  /**
   * Method verifySignUp
   *
   * @description
   * `POST /internal/v1/auth/sign-up/verification` as the actor `anonymous`. The password, when
   * present, travels in the body only.
   *
   * @param {SignUpVerification} request - Address, code, the password of the sign-up when the
   * browser sent one, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  public async verifySignUp(request: SignUpVerification): Promise<SessionIssued> {
    return expectBody(
      'verifySignUpInternal',
      await answered(
        'verifySignUpInternal',
        this.routes.verifySignUpInternal(request, callerClaims('anonymous')),
      ),
      200,
      VerifySignUpInternalResponse,
    );
  }

  /**
   * Method signInWithPassword
   *
   * @description
   * `POST /internal/v1/auth/sign-in` as the actor `anonymous`. The password and the trusted
   * device token, when the browser sent one, travel in the body only.
   *
   * @param {PasswordSignIn} request - Address, password, persistence, browser of the session and
   * the trusted device token of the browser.
   * @returns {Promise<IdentitySignIn>} The session opened, with its token returned once, or the
   * two-step challenge of the account.
   */
  public async signInWithPassword(request: PasswordSignIn): Promise<IdentitySignIn> {
    return signInOf(
      'signInWithPasswordInternal',
      await answered(
        'signInWithPasswordInternal',
        this.routes.signInWithPasswordInternal(request, callerClaims('anonymous')),
      ),
      SignInWithPasswordInternalResponse,
    );
  }

  /** Starts an anonymous federated flow and returns the internal browser binding. */
  public async startFederatedSignIn(request: FederatedSignInStart): Promise<FederatedFlowStarted> {
    const operation = 'startFederatedSignInInternal';
    const response = await answered(
      operation,
      this.routes.startFederatedSignInInternal(request, callerClaims('anonymous')),
    );
    return expectBody(operation, response, 200, StartFederatedSignInInternalResponse);
  }

  /** Exchanges an OAuth callback once for an opaque continuation receipt. */
  public async completeOAuthSignIn(request: FederatedOAuthCallback): Promise<FederatedReceipt> {
    const operation = 'completeOAuthSignInInternal';
    const response = await answered(
      operation,
      this.routes.completeOAuthSignInInternal(request, callerClaims('anonymous')),
    );
    return expectBody(operation, response, 200, CompleteOAuthSignInInternalResponse);
  }

  /** Exchanges a SAML callback once for an opaque continuation receipt. */
  public async completeSamlSignIn(request: FederatedSamlCallback): Promise<FederatedReceipt> {
    const operation = 'completeSamlSignInInternal';
    const response = await answered(
      operation,
      this.routes.completeSamlSignInInternal(request, callerClaims('anonymous')),
    );
    return expectBody(operation, response, 200, CompleteSamlSignInInternalResponse);
  }

  /** Redeems the receipt once and returns the ordinary Identity sign-in outcome. */
  public async finishFederatedSignIn(request: FederatedSignInFinish): Promise<IdentitySignIn> {
    const operation = 'finishFederatedSignInInternal';
    return signInOf(
      operation,
      await answered(
        operation,
        this.routes.finishFederatedSignInInternal(request, callerClaims('anonymous')),
      ),
      FinishFederatedSignInInternalResponse,
    );
  }

  /**
   * Method requestSignInCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/code` as the actor `anonymous`.
   *
   * @param {CodeRequest} request - Address to send a sign-in code to.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was issued.
   */
  public async requestSignInCode(request: CodeRequest): Promise<CodeSent> {
    return expectBody(
      'requestSignInCodeInternal',
      await answered(
        'requestSignInCodeInternal',
        this.routes.requestSignInCodeInternal(request, callerClaims('anonymous')),
      ),
      202,
      RequestSignInCodeInternalResponse,
    );
  }

  /**
   * Method signInWithCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/code/verification` as the actor `anonymous`. The code and the
   * trusted device token, when the browser sent one, travel in the body only.
   *
   * @param {CodeVerification} request - Address, code, persistence, browser of the session and the
   * trusted device token of the browser.
   * @returns {Promise<IdentitySignIn>} The session opened, with its token returned once, or the
   * two-step challenge of the account.
   */
  public async signInWithCode(request: CodeVerification): Promise<IdentitySignIn> {
    return signInOf(
      'signInWithCodeInternal',
      await answered(
        'signInWithCodeInternal',
        this.routes.signInWithCodeInternal(request, callerClaims('anonymous')),
      ),
      SignInWithCodeInternalResponse,
    );
  }

  /**
   * Method inspectSignInChallenge
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/inspection` as the actor `anonymous`. The challenge
   * token travels in the body only. Not retried, as every flow before a session.
   *
   * @param {ChallengeTokenRequest} request - The token of the challenge.
   * @returns {Promise<SignInChallenge>} The challenge, as the sign-in issued it.
   */
  public async inspectSignInChallenge(request: ChallengeTokenRequest): Promise<SignInChallenge> {
    return expectBody(
      'inspectSignInChallengeInternal',
      await answered(
        'inspectSignInChallengeInternal',
        this.routes.inspectSignInChallengeInternal(request, callerClaims('anonymous')),
      ),
      200,
      InspectSignInChallengeInternalResponse,
    );
  }

  /**
   * Method answerSignInChallengeWithAuthenticatorApp
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/authenticator-app` as the actor `anonymous`. The
   * token and the code travel in the body only. Not retried: a wrong answer counts towards the
   * lockout of the two-step answers of the account.
   *
   * @param {AuthenticatorAppAnswer} request - Token, code, trust of the device and browser.
   * @returns {Promise<SessionIssued>} The session opened, and the trusted device with
   * `trustDevice`, each token returned once.
   */
  public async answerSignInChallengeWithAuthenticatorApp(
    request: AuthenticatorAppAnswer,
  ): Promise<SessionIssued> {
    return expectBody(
      'answerSignInChallengeWithAuthenticatorAppInternal',
      await answered(
        'answerSignInChallengeWithAuthenticatorAppInternal',
        this.routes.answerSignInChallengeWithAuthenticatorAppInternal(
          request,
          callerClaims('anonymous'),
        ),
      ),
      200,
      AnswerSignInChallengeWithAuthenticatorAppInternalResponse,
    );
  }

  /**
   * Method answerSignInChallengeWithBackupCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/backup-code` as the actor `anonymous`. The token and
   * the backup code travel in the body only. Not retried: the code works once.
   *
   * @param {BackupCodeAnswer} request - Token, backup code, trust of the device and browser.
   * @returns {Promise<SessionIssued>} The session opened, and the trusted device with
   * `trustDevice`.
   */
  public async answerSignInChallengeWithBackupCode(
    request: BackupCodeAnswer,
  ): Promise<SessionIssued> {
    return expectBody(
      'answerSignInChallengeWithBackupCodeInternal',
      await answered(
        'answerSignInChallengeWithBackupCodeInternal',
        this.routes.answerSignInChallengeWithBackupCodeInternal(request, callerClaims('anonymous')),
      ),
      200,
      AnswerSignInChallengeWithBackupCodeInternalResponse,
    );
  }

  /**
   * Method getSignInChallengeSecurityKeyOptions
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/security-key/options` as the actor `anonymous`. Not
   * retried: each call replaces the options of the challenge. The options keep the members the
   * contract does not list (its validator is loose), for the browser.
   *
   * @param {ChallengeTokenRequest} request - The token of the challenge.
   * @returns {Promise<SecurityKeyAssertionOptions>} The WebAuthn options and their expiry.
   */
  public async getSignInChallengeSecurityKeyOptions(
    request: ChallengeTokenRequest,
  ): Promise<SecurityKeyAssertionOptions> {
    return expectBody(
      'getSignInChallengeSecurityKeyOptionsInternal',
      await answered(
        'getSignInChallengeSecurityKeyOptionsInternal',
        this.routes.getSignInChallengeSecurityKeyOptionsInternal(
          request,
          callerClaims('anonymous'),
        ),
      ),
      200,
      GetSignInChallengeSecurityKeyOptionsInternalResponse,
    );
  }

  /**
   * Method answerSignInChallengeWithSecurityKey
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/security-key` as the actor `anonymous`. The token
   * and the WebAuthn answer travel in the body only. Not retried: a refused answer counts towards
   * the lockout.
   *
   * @param {SecurityKeyAnswer} request - Token, answer of the key, trust of the device, browser.
   * @returns {Promise<SessionIssued>} The session opened, and the trusted device with
   * `trustDevice`.
   */
  public async answerSignInChallengeWithSecurityKey(
    request: SecurityKeyAnswer,
  ): Promise<SessionIssued> {
    return expectBody(
      'answerSignInChallengeWithSecurityKeyInternal',
      await answered(
        'answerSignInChallengeWithSecurityKeyInternal',
        this.routes.answerSignInChallengeWithSecurityKeyInternal(
          request,
          callerClaims('anonymous'),
        ),
      ),
      200,
      AnswerSignInChallengeWithSecurityKeyInternalResponse,
    );
  }

  /**
   * Method revokeSession
   *
   * @description
   * `DELETE /internal/v1/sessions/{sessionId}` as the user of the current organization context,
   * retried once on a connection error or a `503` (`DELETE` is idempotent). identity-service
   * revokes only a session of that user: another one, or an unknown id, answers
   * `404 session.not-found`.
   *
   * @param {string} sessionId - Id of the session (a UUID): the one the introspection returned for
   * the sign-out, or the one of the public path, checked as a UUID, for
   * `DELETE /v1/sessions/{sessionId}`.
   * @returns {Promise<void>} Resolves once the session is revoked, or had already ended.
   */
  public async revokeSession(sessionId: string): Promise<void> {
    expectStatus(
      'revokeSession',
      await answered('revokeSession', this.routes.revokeSession(sessionId)),
      204,
    );
  }

  /**
   * Method getUser
   *
   * @description
   * `GET /internal/v1/users/{userId}` as the user of the current organization context, retried
   * once on a connection error or a `503` (`GET` is idempotent).
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @returns {Promise<User>} The account.
   */
  public async getUser(userId: string): Promise<User> {
    return expectBody(
      'getUser',
      await answered('getUser', this.routes.getUser(userId)),
      200,
      GetUserResponse,
    );
  }

  /** Reserves an avatar for the verified account and relays the optional replay key. */
  public async reserveAvatarUpload(
    userId: string,
    body: { readonly contentType: string; readonly sizeBytes: number },
    idempotencyKey: string | undefined,
  ): Promise<ProfileMediaReservation> {
    const operation = 'reserveAvatarUploadInternal';
    const options: InternalRequestInit = {
      ...NOT_RETRIED,
      ...(idempotencyKey === undefined ? {} : { headers: { 'Idempotency-Key': idempotencyKey } }),
    };
    // The generated MIME type lists accepted values. The owner checks live authorization and
    // reservation replay before applying that policy, including the contracted 422 refusals.
    const declaration: StartAvatarUpload = {
      contentType: body.contentType as StartAvatarUpload['contentType'],
      sizeBytes: body.sizeBytes,
    };
    const response = await answered(
      operation,
      this.routes.reserveAvatarUploadInternal(userId, declaration, options),
    );
    const reservation = expectBody(operation, response, 201, ReserveAvatarUploadInternalResponse);
    const location = this.routes.getGetAvatarUploadStateInternalUrl(userId, reservation.uploadId);
    if (response.headers.get('Location')?.toLowerCase() !== location.toLowerCase()) {
      throw outsideContract(IDENTITY_SERVICE, operation, 'an inconsistent reservation Location');
    }
    return reservation;
  }

  /** Reads the state of this verified account's reservation before Storage preparation. */
  public async getAvatarUploadState(
    userId: string,
    uploadId: string,
  ): Promise<ProfileMediaReservationState> {
    const operation = 'getAvatarUploadStateInternal';
    const response = await answered(
      operation,
      this.routes.getAvatarUploadStateInternal(userId, uploadId),
    );
    const reservation = expectBody(operation, response, 200, GetAvatarUploadStateInternalResponse);
    if (reservation.uploadId.toLowerCase() !== uploadId.toLowerCase()) {
      throw outsideContract(IDENTITY_SERVICE, operation, 'an inconsistent reservation id');
    }
    return reservation;
  }

  /** Commits this account's prepared avatar once and returns Identity's current ETag. */
  public async setAvatar(
    userId: string,
    uploadId: string,
    ifMatch: string | undefined,
  ): Promise<{ etag: string }> {
    const operation = 'setAvatarInternal';
    const options: InternalRequestInit = { ...NOT_RETRIED, ...ifMatchHeader(ifMatch) };
    const response = await answered(
      operation,
      this.routes.setAvatarInternal(userId, { uploadId }, options),
    );
    return avatarEtag(operation, response);
  }

  /** Clears this account's avatar once and returns Identity's current ETag. */
  public async deleteAvatar(
    userId: string,
    ifMatch: string | undefined,
  ): Promise<{ etag: string }> {
    const operation = 'deleteAvatarInternal';
    const options: InternalRequestInit = { ...NOT_RETRIED, ...ifMatchHeader(ifMatch) };
    const response = await answered(operation, this.routes.deleteAvatarInternal(userId, options));
    return avatarEtag(operation, response);
  }

  /** Reads the current avatar reference, keeping verified organization claims for member reads. */
  public async getAvatarReference(userId: string): Promise<CurrentAvatarReference> {
    const operation = 'getAvatarReferenceInternal';
    const response = await answered(operation, this.routes.getAvatarReferenceInternal(userId));
    return expectBody(operation, response, 200, GetAvatarReferenceInternalResponse);
  }

  /**
   * Method introspectApiToken
   *
   * @description
   * `POST /internal/v1/api-tokens/introspect` as the actor `system`, retried once on a connection
   * error or a `503`: the contract makes the call idempotent. An active answer records the last
   * use of the token at identity-service, at most once a minute.
   *
   * @param {string} token - Value of the bearer token. A secret: it travels in the body only.
   * @returns {Promise<IdentityApiToken | null>} The token, or `null` when it is not an active
   * personal API token.
   */
  public async introspectApiToken(token: string): Promise<IdentityApiToken | null> {
    const options: InternalRequestInit = { ...callerClaims('system'), idempotent: true };
    const answer: z.output<typeof IntrospectApiTokenResponse> = expectBody(
      'introspectApiToken',
      await answered('introspectApiToken', this.routes.introspectApiToken({ token }, options)),
      200,
      IntrospectApiTokenResponse,
    );
    if (!answer.active || answer.tokenType !== API_TOKEN_TYPE) {
      return null;
    }
    return {
      apiTokenId: answer.apiTokenId,
      userId: answer.userId,
      organizationId: answer.organizationId,
      role: answer.role,
      scopes: answer.scopes,
      expiresAt: answer.expiresAt,
      ...(answer.withheldOrganization === undefined
        ? {}
        : { withheldOrganization: answer.withheldOrganization }),
    };
  }

  /**
   * Method updateUser
   *
   * @description
   * `PATCH /internal/v1/users/{userId}` as the user of the current organization context, with the
   * `If-Match` of the public request relayed unchanged. Not retried: `PATCH` is not declared
   * idempotent.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {ProfilePatch} patch - JSON Merge Patch of the profile.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<User>} The account after the change.
   */
  public async updateUser(
    userId: string,
    patch: ProfilePatch,
    ifMatch: string | undefined,
  ): Promise<User> {
    return expectBody(
      'updateUser',
      await answered('updateUser', this.routes.updateUser(userId, patch, ifMatchHeader(ifMatch))),
      200,
      UpdateUserResponse,
    );
  }

  /**
   * Method switchSessionOrganization
   *
   * @description
   * `PUT /internal/v1/sessions/{sessionId}/organization` as the user of the current organization
   * context, retried once on a connection error or a `503` (`PUT` is idempotent: choosing the
   * same organization again changes nothing).
   *
   * @param {string} sessionId - Id of the session (a UUID), as the introspection returned it.
   * @param {string} organizationId - Organization to act on.
   * @returns {Promise<SessionOrganization>} The organization and the role of the session.
   */
  public async switchSessionOrganization(
    sessionId: string,
    organizationId: string,
  ): Promise<SessionOrganization> {
    return expectBody(
      'switchSessionOrganization',
      await answered(
        'switchSessionOrganization',
        this.routes.switchSessionOrganization(sessionId, { organizationId }),
      ),
      200,
      SwitchSessionOrganizationResponse,
    );
  }

  /**
   * Method createApiToken
   *
   * @description
   * `POST /internal/v1/api-tokens` as the user of the current organization context, which carries
   * the current organization of the session. Not retried. The answer holds the secret of the
   * token, returned once: never logged.
   *
   * @param {ApiTokenCreation} creation - Session of the request, whose recent authentication
   * identity-service checks, name, scopes and expiration of the token.
   * @returns {Promise<ApiTokenCreated>} The token and its secret.
   */
  public async createApiToken(creation: ApiTokenCreation): Promise<ApiTokenCreated> {
    return expectBody(
      'createApiTokenInternal',
      await answered('createApiTokenInternal', this.routes.createApiTokenInternal(creation)),
      201,
      CreateApiTokenInternalResponse,
    );
  }

  /**
   * Method listApiTokens
   *
   * @description
   * `GET /internal/v1/api-tokens` as the user of the current organization context.
   *
   * @param {ListApiTokensInternalParams} page - Cursor and page size.
   * @returns {Promise<ApiTokenPage>} One page of tokens, never with their secret.
   */
  public async listApiTokens(page: ListApiTokensInternalParams): Promise<ApiTokenPage> {
    return expectBody(
      'listApiTokensInternal',
      await answered('listApiTokensInternal', this.routes.listApiTokensInternal(page)),
      200,
      ListApiTokensInternalResponse,
    );
  }

  /**
   * Method revokeApiToken
   *
   * @description
   * `DELETE /internal/v1/api-tokens/{apiTokenId}` as the user of the current organization context,
   * retried once on a connection error or a `503` (`DELETE` is idempotent).
   *
   * @param {string} apiTokenId - Id of the token.
   * @returns {Promise<void>} Resolves once the token is revoked, or was already.
   */
  public async revokeApiToken(apiTokenId: string): Promise<void> {
    expectStatus(
      'revokeApiTokenInternal',
      await answered('revokeApiTokenInternal', this.routes.revokeApiTokenInternal(apiTokenId)),
      204,
    );
  }

  /**
   * Method requestPasswordReset
   *
   * @description
   * `POST /internal/v1/auth/password-reset` as the actor `anonymous`. Not retried.
   *
   * @param {PasswordResetRequest} request - Address and browser that asks for the link.
   * @returns {Promise<PasswordResetLinkSent>} The same answer whether or not a link was issued.
   */
  public async requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetLinkSent> {
    return expectBody(
      'requestPasswordResetInternal',
      await answered(
        'requestPasswordResetInternal',
        this.routes.requestPasswordResetInternal(request, callerClaims('anonymous')),
      ),
      202,
      RequestPasswordResetInternalResponse,
    );
  }

  /**
   * Method inspectPasswordResetLink
   *
   * @description
   * `POST /internal/v1/auth/password-reset/inspection` as the actor `anonymous`. The token is a
   * secret: it travels in the body only. Not retried.
   *
   * @param {PasswordResetToken} request - The token of the link.
   * @returns {Promise<PasswordResetLink>} The address of the account of the link, its expiry and
   * the open sessions of the account.
   */
  public async inspectPasswordResetLink(request: PasswordResetToken): Promise<PasswordResetLink> {
    return expectBody(
      'inspectPasswordResetLinkInternal',
      await answered(
        'inspectPasswordResetLinkInternal',
        this.routes.inspectPasswordResetLinkInternal(request, callerClaims('anonymous')),
      ),
      200,
      InspectPasswordResetLinkInternalResponse,
    );
  }

  /**
   * Method confirmPasswordReset
   *
   * @description
   * `POST /internal/v1/auth/password-reset/confirmation` as the actor `anonymous`. The token and
   * the new password travel in the body only. Not retried: the link works once.
   *
   * @param {PasswordResetConfirmation} request - Token, new password, whether to close the other
   * sessions, and the browser.
   * @returns {Promise<PasswordResetCompleted>} The address of the account and the sessions closed.
   */
  public async confirmPasswordReset(
    request: PasswordResetConfirmation,
  ): Promise<PasswordResetCompleted> {
    return expectBody(
      'confirmPasswordResetInternal',
      await answered(
        'confirmPasswordResetInternal',
        this.routes.confirmPasswordResetInternal(request, callerClaims('anonymous')),
      ),
      200,
      ConfirmPasswordResetInternalResponse,
    );
  }

  /**
   * Method reauthenticate
   *
   * @description
   * `POST /internal/v1/sessions/{sessionId}/reauthentication` as the user of the current
   * organization context. The password or the code travels in the body only. Not retried: a
   * failed password or code counts towards a lockout.
   *
   * @param {string} sessionId - Id of the session (a UUID), as the introspection returned it.
   * @param {ReauthenticationRequest} request - The password of the account, or a code of its
   * authenticator app.
   * @returns {Promise<RecentAuthentication>} The window of recent authentication of the session.
   */
  public async reauthenticate(
    sessionId: string,
    request: ReauthenticationRequest,
  ): Promise<RecentAuthentication> {
    return expectBody(
      'reauthenticateInternal',
      await answered(
        'reauthenticateInternal',
        this.routes.reauthenticateInternal(sessionId, request),
      ),
      200,
      ReauthenticateInternalResponse,
    );
  }

  /**
   * Method changePassword
   *
   * @description
   * `PUT /internal/v1/users/{userId}/password` as the user of the current organization context.
   * Not retried, although it is a `PUT`: a change identity-service applied before the connection
   * failed would be repeated with a current password that no longer works, which would count a
   * failed password towards the lockout of the address.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {PasswordChange} change - Session of the request, current and new passwords, browser.
   * @returns {Promise<User>} The account after the change.
   */
  public async changePassword(userId: string, change: PasswordChange): Promise<User> {
    return expectBody(
      'changePasswordInternal',
      await answered(
        'changePasswordInternal',
        this.routes.changePasswordInternal(userId, change, NOT_RETRIED),
      ),
      200,
      ChangePasswordInternalResponse,
    );
  }

  /**
   * Method requestEmailChange
   *
   * @description
   * `POST /internal/v1/users/{userId}/email-change` as the user of the current organization
   * context. Not retried.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {EmailChangeRequest} request - Session of the request and new address.
   * @returns {Promise<EmailChangeCodeSent>} When the code expires and when another can be asked
   * for.
   */
  public async requestEmailChange(
    userId: string,
    request: EmailChangeRequest,
  ): Promise<EmailChangeCodeSent> {
    return expectBody(
      'requestEmailChangeInternal',
      await answered(
        'requestEmailChangeInternal',
        this.routes.requestEmailChangeInternal(userId, request),
      ),
      202,
      RequestEmailChangeInternalResponse,
    );
  }

  /**
   * Method confirmEmailChange
   *
   * @description
   * `POST /internal/v1/users/{userId}/email-change/confirmation` as the user of the current
   * organization context. The code travels in the body only. Not retried.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {EmailChangeConfirmation} confirmation - Session of the request, code and browser.
   * @returns {Promise<User>} The account with its new address.
   */
  public async confirmEmailChange(
    userId: string,
    confirmation: EmailChangeConfirmation,
  ): Promise<User> {
    return expectBody(
      'confirmEmailChangeInternal',
      await answered(
        'confirmEmailChangeInternal',
        this.routes.confirmEmailChangeInternal(userId, confirmation),
      ),
      200,
      ConfirmEmailChangeInternalResponse,
    );
  }

  /**
   * Method scheduleAccountDeletion
   *
   * @description
   * `POST /internal/v1/users/{userId}/deletion` as the user of the current organization context.
   * Not retried.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {DeletionRequest} request - Session of the request.
   * @returns {Promise<DeletionScheduled>} When the account will be deleted.
   */
  public async scheduleAccountDeletion(
    userId: string,
    request: DeletionRequest,
  ): Promise<DeletionScheduled> {
    return expectBody(
      'scheduleAccountDeletionInternal',
      await answered(
        'scheduleAccountDeletionInternal',
        this.routes.scheduleAccountDeletionInternal(userId, request),
      ),
      202,
      ScheduleAccountDeletionInternalResponse,
    );
  }

  /**
   * Method listUserSessions
   *
   * @description
   * `GET /internal/v1/users/{userId}/sessions` as the user of the current organization context,
   * retried once on a connection error or a `503` (`GET` is idempotent).
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {ListUserSessionsInternalParams} params - Session of the request, cursor and page size.
   * @returns {Promise<OpenSessionPage>} One page of the open sessions.
   */
  public async listUserSessions(
    userId: string,
    params: ListUserSessionsInternalParams,
  ): Promise<OpenSessionPage> {
    return expectBody(
      'listUserSessionsInternal',
      await answered(
        'listUserSessionsInternal',
        this.routes.listUserSessionsInternal(userId, params),
      ),
      200,
      ListUserSessionsInternalResponse,
    );
  }

  /**
   * Method revokeOtherSessions
   *
   * @description
   * `POST /internal/v1/sessions/{sessionId}/revoke-others` as the user of the current
   * organization context. Not retried.
   *
   * @param {string} sessionId - Id of the session to keep (a UUID), as the introspection returned
   * it.
   * @returns {Promise<RevokedSessions>} How many sessions were revoked.
   */
  public async revokeOtherSessions(sessionId: string): Promise<RevokedSessions> {
    return expectBody(
      'revokeOtherSessionsInternal',
      await answered(
        'revokeOtherSessionsInternal',
        this.routes.revokeOtherSessionsInternal(sessionId),
      ),
      200,
      RevokeOtherSessionsInternalResponse,
    );
  }

  /**
   * Method getTwoStepVerification
   *
   * @description
   * `GET /internal/v1/users/{userId}/two-step-verification` as the user of the current
   * organization context, retried once on a connection error or a `503` (`GET` is idempotent).
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @returns {Promise<TwoStepVerification>} The two-step verification of the account, without any
   * secret.
   */
  public async getTwoStepVerification(userId: string): Promise<TwoStepVerification> {
    return expectBody(
      'getTwoStepVerificationInternal',
      await answered(
        'getTwoStepVerificationInternal',
        this.routes.getTwoStepVerificationInternal(userId),
      ),
      200,
      GetTwoStepVerificationInternalResponse,
    );
  }

  /**
   * Method disableTwoStepVerification
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/disable` as the user of the current
   * organization context. Not retried.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {TwoStepChange} change - Session of the request and browser.
   * @returns {Promise<void>} Resolves once two-step verification is off, or was already.
   */
  public async disableTwoStepVerification(userId: string, change: TwoStepChange): Promise<void> {
    expectStatus(
      'disableTwoStepVerificationInternal',
      await answered(
        'disableTwoStepVerificationInternal',
        this.routes.disableTwoStepVerificationInternal(userId, change),
      ),
      204,
    );
  }

  /**
   * Method startAuthenticatorAppSetup
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup` as the user of
   * the current organization context. Not retried: each start replaces the pending setup. The
   * answer holds the TOTP secret, returned once: never logged.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {SessionReference} reference - Session of the request.
   * @returns {Promise<AuthenticatorAppSetup>} The secret, its `otpauth://` URI and its expiry.
   */
  public async startAuthenticatorAppSetup(
    userId: string,
    reference: SessionReference,
  ): Promise<AuthenticatorAppSetup> {
    return expectBody(
      'startAuthenticatorAppSetupInternal',
      await answered(
        'startAuthenticatorAppSetupInternal',
        this.routes.startAuthenticatorAppSetupInternal(userId, reference),
      ),
      200,
      StartAuthenticatorAppSetupInternalResponse,
    );
  }

  /**
   * Method confirmAuthenticatorAppSetup
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup/confirmation`
   * as the user of the current organization context. The code travels in the body only. Not
   * retried. The answer may hold the backup codes, returned once: never logged.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {AuthenticatorAppConfirmation} confirmation - Session of the request, code, browser.
   * @returns {Promise<AuthenticatorAppConfigured>} The two-step verification of the account and
   * its new backup codes, `null` for a reconfiguration.
   */
  public async confirmAuthenticatorAppSetup(
    userId: string,
    confirmation: AuthenticatorAppConfirmation,
  ): Promise<AuthenticatorAppConfigured> {
    return expectBody(
      'confirmAuthenticatorAppSetupInternal',
      await answered(
        'confirmAuthenticatorAppSetupInternal',
        this.routes.confirmAuthenticatorAppSetupInternal(userId, confirmation),
      ),
      200,
      ConfirmAuthenticatorAppSetupInternalResponse,
    );
  }

  /**
   * Method regenerateBackupCodes
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/backup-codes/regenerate` as the user
   * of the current organization context. Not retried: each call replaces the codes. The answer
   * holds the codes, returned once: never logged.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {TwoStepChange} change - Session of the request and browser.
   * @returns {Promise<BackupCodes>} The new backup codes.
   */
  public async regenerateBackupCodes(userId: string, change: TwoStepChange): Promise<BackupCodes> {
    return expectBody(
      'regenerateBackupCodesInternal',
      await answered(
        'regenerateBackupCodesInternal',
        this.routes.regenerateBackupCodesInternal(userId, change),
      ),
      200,
      RegenerateBackupCodesInternalResponse,
    );
  }

  /**
   * Method startSecurityKeyRegistration
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/security-keys/registration` as the
   * user of the current organization context. Not retried: each start replaces the pending
   * registration. The options keep the members the contract does not list, for the browser.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {SessionReference} reference - Session of the request.
   * @returns {Promise<SecurityKeyRegistration>} The WebAuthn creation options and their expiry.
   */
  public async startSecurityKeyRegistration(
    userId: string,
    reference: SessionReference,
  ): Promise<SecurityKeyRegistration> {
    return expectBody(
      'startSecurityKeyRegistrationInternal',
      await answered(
        'startSecurityKeyRegistrationInternal',
        this.routes.startSecurityKeyRegistrationInternal(userId, reference),
      ),
      200,
      StartSecurityKeyRegistrationInternalResponse,
    );
  }

  /**
   * Method addSecurityKey
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/security-keys` as the user of the
   * current organization context. The WebAuthn answer travels in the body only. Not retried.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {SecurityKeyAddition} addition - Session of the request, name, answer of the browser,
   * browser.
   * @returns {Promise<SecurityKey>} The key registered.
   */
  public async addSecurityKey(userId: string, addition: SecurityKeyAddition): Promise<SecurityKey> {
    return expectBody(
      'addSecurityKeyInternal',
      await answered(
        'addSecurityKeyInternal',
        this.routes.addSecurityKeyInternal(userId, addition),
      ),
      201,
      AddSecurityKeyInternalResponse,
    );
  }

  /**
   * Method removeSecurityKey
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/security-keys/{securityKeyId}/remove`
   * as the user of the current organization context. Not retried.
   *
   * @param {string} userId - Id of the account (a UUID), as the introspection returned it.
   * @param {string} securityKeyId - Id of the key (a UUID), from the public path.
   * @param {TwoStepChange} change - Session of the request and browser.
   * @returns {Promise<void>} Resolves once the key is removed.
   */
  public async removeSecurityKey(
    userId: string,
    securityKeyId: string,
    change: TwoStepChange,
  ): Promise<void> {
    expectStatus(
      'removeSecurityKeyInternal',
      await answered(
        'removeSecurityKeyInternal',
        this.routes.removeSecurityKeyInternal(userId, securityKeyId, change),
      ),
      204,
    );
  }

  /**
   * Method getAuthenticationPolicy
   *
   * @description
   * `GET /internal/v1/organization/authentication-policy` as the user of the current organization
   * context, which carries the current organization of the session; retried once on a connection
   * error or a `503` (`GET` is idempotent).
   *
   * @returns {Promise<AuthenticationPolicy>} The policy of the organization of the context.
   */
  public async getAuthenticationPolicy(): Promise<AuthenticationPolicy> {
    return expectBody(
      'getAuthenticationPolicyInternal',
      await answered(
        'getAuthenticationPolicyInternal',
        this.routes.getAuthenticationPolicyInternal(),
      ),
      200,
      GetAuthenticationPolicyInternalResponse,
    );
  }

  /**
   * Method updateAuthenticationPolicy
   *
   * @description
   * `PATCH /internal/v1/organization/authentication-policy?sessionId=` as the user of the current
   * organization context, with the `If-Match` of the public request relayed unchanged. Not
   * retried: `PATCH` is not declared idempotent.
   *
   * @param {string} sessionId - Id of the session (a UUID), as the introspection returned it,
   * whose recent authentication identity-service checks.
   * @param {AuthenticationPolicyPatch} patch - JSON Merge Patch of the policy.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<AuthenticationPolicy>} The policy after the change.
   */
  public async updateAuthenticationPolicy(
    sessionId: string,
    patch: AuthenticationPolicyPatch,
    ifMatch: string | undefined,
  ): Promise<AuthenticationPolicy> {
    return expectBody(
      'updateAuthenticationPolicyInternal',
      await answered(
        'updateAuthenticationPolicyInternal',
        this.routes.updateAuthenticationPolicyInternal(
          patch,
          { sessionId },
          ifMatchHeader(ifMatch),
        ),
      ),
      200,
      UpdateAuthenticationPolicyInternalResponse,
    );
  }
  // #endregion
}
