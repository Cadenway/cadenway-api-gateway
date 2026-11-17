import type {
  ApiTokenCreated,
  ApiTokenCreation,
  ApiTokenPage,
  CodeRequest,
  CodeSent,
  CodeVerification,
  ListApiTokensInternalParams,
  PasswordSignIn,
  ProfilePatch,
  SessionIssued,
  SessionOrganization,
  SignInMethods,
  SignInMethodsRequest,
  SignUpRequest,
  SignUpVerification,
  User,
} from '@cadenway/contracts/types/internal/identity-service';
import {
  CreateApiTokenInternalResponse,
  DiscoverSignInMethodsInternalResponse,
  GetUserResponse,
  IntrospectApiTokenResponse,
  IntrospectTokenResponse,
  ListApiTokensInternalResponse,
  RequestSignInCodeInternalResponse,
  ResendSignUpCodeInternalResponse,
  SignInWithCodeInternalResponse,
  SignInWithPasswordInternalResponse,
  SignUpInternalResponse,
  SwitchSessionOrganizationResponse,
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

/**
 * Class IdentityServiceClient
 *
 * @description
 * Outgoing adapter of identity-service: the functions generated from
 * `openapi/internal/identity-service.yaml`, called through one `InternalHttpClient` of
 * `@cadenway/nest-common`, behind the ports of the session guard and of the routes.
 *
 * - Every call carries an internal token signed by the gateway with `aud: identity-service`: the
 *   actor `anonymous` for the sign-up and sign-in flows, `system` for the two introspections, and
 *   the user of the current organization context for every other call (with the organization of
 *   that context, which the personal API token routes require).
 * - The internal HTTP client gives each call the time left to the request (2 seconds at most), one
 *   retry after a connection error or a `503` for an idempotent call (both introspections are
 *   declared idempotent by their contract, as `GET`, `PUT` and `DELETE` are; the flows and the
 *   other `POST` and `PATCH` calls are not retried), and the circuit breaker of identity-service. It throws its problems: a relayed client error, or `503 upstream.*`.
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
   * @param {ApiTokenCreation} creation - Name, scopes and expiration of the token.
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
  // #endregion
}
