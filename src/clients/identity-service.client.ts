import type {
  CodeRequest,
  CodeSent,
  CodeVerification,
  PasswordSignIn,
  SessionIssued,
  SignInMethods,
  SignInMethodsRequest,
  SignUpRequest,
  SignUpVerification,
  User,
} from '@cadenway/contracts/types/internal/identity-service';
import {
  DiscoverSignInMethodsInternalResponse,
  GetUserResponse,
  IntrospectTokenResponse,
  RequestSignInCodeInternalResponse,
  ResendSignUpCodeInternalResponse,
  SignInWithCodeInternalResponse,
  SignInWithPasswordInternalResponse,
  SignUpInternalResponse,
  VerifySignUpInternalResponse,
} from '@cadenway/contracts/validators/internal/identity-service';
import {
  ProblemException,
  type InternalActorType,
  type InternalHttpClient,
  type InternalRequestInit,
  type InternalTokenClaims,
} from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';
import type { z } from 'zod';

import type { SessionIntrospector } from '../auth/session-introspector.port.js';
import type { VerifiedSession } from '../auth/verified-session.js';
import type { IdentityAuth } from '../routes/auth/identity-auth.port.js';
import type { IdentityUsers } from '../routes/me/identity-users.port.js';
import { getIdentityServiceInternalRoutes } from './generated/identity-service.js';

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
 * `tokenType` of an active session token in the introspection. Any other type (personal API
 * tokens come later) is not a session, and a cookie carrying one is not active.
 *
 * @type {string}
 */
const SESSION_TOKEN_TYPE: string = 'session';

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
 * Interface GeneratedResponse
 *
 * @description
 * What a generated function resolves with: the status and the parsed body of a response the
 * internal HTTP client let through (below 400).
 */
interface GeneratedResponse {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * HTTP status of the response.
   *
   * @type {number}
   * @readonly
   */
  readonly status: number;

  /**
   * Property data
   *
   * @description
   * Parsed JSON body, not validated yet.
   *
   * @type {unknown}
   * @readonly
   */
  readonly data: unknown;
  // #endregion
}

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
 * Function outsideContract
 *
 * @description
 * Builds the problem of a response of identity-service that does not match its contract: a defect
 * of identity-service, answered as `503 upstream.failed`, as the internal HTTP client answers a
 * server error. The cause names the offending members, never their values, which may be secrets.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {string} reason - What did not match.
 * @returns {ProblemException} The problem to throw.
 */
function outsideContract(operation: string, reason: string): ProblemException {
  return new ProblemException({
    status: 503,
    code: 'upstream.failed',
    detail: 'A service this request depends on is not available.',
    details: { service: IDENTITY_SERVICE },
    cause: new Error(`${IDENTITY_SERVICE} answered ${operation} outside its contract: ${reason}.`),
  });
}

/**
 * Function expectStatus
 *
 * @description
 * Checks that a response has the success status of its operation.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedResponse} response - Response of the generated function.
 * @param {number} status - Success status of the operation.
 * @throws {ProblemException} 503 `upstream.failed` for another status.
 */
function expectStatus(operation: string, response: GeneratedResponse, status: number): void {
  if (response.status !== status) {
    throw outsideContract(operation, `status ${String(response.status)}`);
  }
}

/**
 * Function expectBody
 *
 * @description
 * Checks a response against its operation: the success status, then the body against the zod
 * validator of `@cadenway/contracts`. The parsed value keeps the members of the contract only, so
 * an unexpected member of identity-service never travels further.
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
  expectStatus(operation, response, status);
  const parsed: z.ZodSafeParseResult<z.output<TSchema>> = schema.safeParse(response.data);
  if (!parsed.success) {
    const members: string = parsed.error.issues
      .map((issue: z.core.$ZodIssue) => issue.path.join('.') || '(body)')
      .join(', ');
    throw outsideContract(operation, `invalid ${members}`);
  }
  return parsed.data;
}

/**
 * Function answered
 *
 * @description
 * Awaits a generated call. The generated code parses a success body with `JSON.parse`, whose
 * `SyntaxError` quotes part of the body, which may hold a session token: a body that is not JSON
 * becomes `503 upstream.failed` without that message, so it reaches neither the browser nor the
 * log line of the request. Every other error, the problems of the internal HTTP client included,
 * is thrown unchanged.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {Promise<TResponse>} call - The generated call.
 * @returns {Promise<TResponse>} What the call resolved with.
 * @throws {ProblemException} 503 `upstream.failed` for a body that is not JSON.
 */
async function answered<TResponse>(
  operation: string,
  call: Promise<TResponse>,
): Promise<TResponse> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw outsideContract(operation, 'a body that is not JSON');
    }
    throw error;
  }
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
 *   actor `anonymous` for the sign-up and sign-in flows, `system` for the introspection, and the
 *   user of the current organization context for the revocation and the reading of the account.
 * - The internal HTTP client gives each call the time left to the request (2 seconds at most), one
 *   retry after a connection error or a `503` for an idempotent call (the introspection is
 *   declared idempotent by its contract; the flows are not retried), and the circuit breaker of
 *   identity-service. It throws its problems: a relayed client error, or `503 upstream.*`.
 * - Every success is checked against the internal contract before it is returned; a mismatch is
 *   `503 upstream.failed`.
 */
export class IdentityServiceClient implements SessionIntrospector, IdentityAuth, IdentityUsers {
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
  /**
   * Method introspect
   *
   * @description
   * `POST /internal/v1/tokens/introspect` as the actor `system`, retried once on a connection
   * error or a `503`: the contract makes the call idempotent.
   *
   * @param {string} token - Value of the session cookie. A secret: it travels in the body only.
   * @returns {Promise<VerifiedSession | null>} The session, or `null` when the token is not an
   * active session token.
   */
  public async introspect(token: string): Promise<VerifiedSession | null> {
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
   * `POST /internal/v1/auth/sign-in` as the actor `anonymous`.
   *
   * @param {PasswordSignIn} request - Address, password, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  public async signInWithPassword(request: PasswordSignIn): Promise<SessionIssued> {
    return expectBody(
      'signInWithPasswordInternal',
      await answered(
        'signInWithPasswordInternal',
        this.routes.signInWithPasswordInternal(request, callerClaims('anonymous')),
      ),
      200,
      SignInWithPasswordInternalResponse,
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
   * `POST /internal/v1/auth/sign-in/code/verification` as the actor `anonymous`.
   *
   * @param {CodeVerification} request - Address, code, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  public async signInWithCode(request: CodeVerification): Promise<SessionIssued> {
    return expectBody(
      'signInWithCodeInternal',
      await answered(
        'signInWithCodeInternal',
        this.routes.signInWithCodeInternal(request, callerClaims('anonymous')),
      ),
      200,
      SignInWithCodeInternalResponse,
    );
  }

  /**
   * Method revokeSession
   *
   * @description
   * `DELETE /internal/v1/sessions/{sessionId}` as the user of the current organization context,
   * retried once on a connection error or a `503` (`DELETE` is idempotent).
   *
   * @param {string} sessionId - Id of the session (a UUID), as the introspection returned it.
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
  // #endregion
}
