import { CONFIG, setRequestOrganizationContext } from '@cadenway/nest-common';
import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import {
  apiTokenInvalidProblem,
  apiTokenNotAcceptedProblem,
  bearerFailureLimitExceededProblem,
  organizationNotSelectedProblem,
  organizationWithheldProblem,
  scopeMissingProblem,
} from '../../../../../../problems/credential-problems.js';
import {
  sessionExpiredProblem,
  sessionRequiredProblem,
} from '../../../../../../problems/session-problems.js';
import { toPublicProblem } from '../../../../../../problems/upstream-problem.js';
import { toClientAddress } from '../../../../../../presentation/http/mappers/client-address.mapper.js';
import { attachVerifiedCredential } from '../../../../../../presentation/http/session/request-session.js';
import { readSessionCookie } from '../../../../../../presentation/http/session/session-cookie.js';
import type { VerifiedApiToken } from '../../../../application/models/api-token/verified-api-token.model.js';
import type { VerifiedSession } from '../../../../application/models/session/verified-session.model.js';
import type { VerifyApiTokenOutput } from '../../../../application/use-cases/commands/api-token/verify-api-token/verify-api-token.output.js';
import { VerifyApiToken } from '../../../../application/use-cases/commands/api-token/verify-api-token/verify-api-token.use-case.js';
import { VerifySession } from '../../../../application/use-cases/queries/session/verify-session/verify-session.use-case.js';
import {
  readBearerToken,
  type BearerToken,
} from '../../validation/credential/bearer-token.validation.js';
import {
  acceptsSession,
  apiTokenScopesOf,
  credentialIsOptional,
  needsCredential,
  OPERATION_SECURITY,
  type OperationSecurity,
} from '../../validation/credential/operation-security.validation.js';
import {
  assertCookieRequestSameSite,
  isUnsafeMethod,
} from '../../validation/session/cross-site.validation.js';

/**
 * Class CredentialGuard
 *
 * @description
 * Authenticates a request as the `security` of its public operation says
 * (`CredentialGuard.requires` on every handler it guards), on every request and without a cache:
 * the session cookie `__Host-cw_session` and the personal API token of
 * `Authorization: Bearer cw_pat_...` are opaque, so they are introspected at identity-service each
 * time, and a revoked one stops at the next request. Known cost: while identity-service is
 * unavailable, so are the routes it guards (`503 upstream.*`).
 *
 * 1. An operation without a credential (`security: []`) reads neither the cookie nor a bearer
 *    token: a stale one never makes it fail.
 * 2. A request that carries a bearer token is authenticated with that token alone, and its cookie
 *    is ignored; an operation whose credential is optional (the sign-out) ignores the bearer token
 *    instead. A client address that failed 10 bearer-token authentications in the current minute
 *    answers `429 rate-limit.exceeded` with `Retry-After` before any call, whatever its token. A
 *    token that cannot be a personal API token, or that the introspection does not find active,
 *    answers `401 auth.api-token-invalid` and counts as a failure of the address. Then the
 *    operation must accept a token
 *    (`403 auth.api-token-not-accepted`); a token whose organization identity-service withholds
 *    for want of two-step verification of its user (`withheldOrganization`) acts on nothing and
 *    answers `403 organization.mfa-required` with `details.organizationId` (`auth.scope-missing`
 *    for a code the public contracts do not declare), before its scopes are looked at; then the token must hold every scope of its `apiToken` requirement
 *    (`403 auth.scope-missing`). A token needs no `Origin`: it is no ambient credential.
 * 3. Otherwise the cookie: none answers `401 auth.session-required`; an unsafe request then passes
 *    the cross-site check (`403 auth.csrf-rejected`) before any call; a cookie that cannot be a
 *    token, or that the introspection does not find active, answers `401 auth.session-expired`.
 *    With an optional credential, both let the route run without an identity. A session holds
 *    every scope. An operation on the current organization answers
 *    `403 organization.mfa-required` (`details.organizationId`) when identity-service withholds
 *    the current organization of the session for want of two-step verification
 *    (`withheldOrganization`; `organization.not-selected` for a code the public contracts do not
 *    declare), checked first, and `403 organization.not-selected` when the session has none; the operations that need no organization (the account, the choice of an
 *    organization) run without one, so that the person can set two-step verification up.
 * 4. A verified credential gives the request its organization context with
 *    `setRequestOrganizationContext` of `@cadenway/nest-common`, from the introspection only: the
 *    user, and the organization, role and scopes identity-service returned, never an organization
 *    or a role when the introspection carries `withheldOrganization`. The internal HTTP
 *    client signs the internal token of every call from it, and the log lines of the request carry
 *    `organizationId` and `userId`. The credential itself (its id, never its secret) is kept with
 *    `attachVerifiedCredential` for the rate limit, the sign-out and the choice of organization.
 *
 * A failed introspection is `503 upstream.*`, whatever identity-service answered.
 */
@Injectable()
export class CredentialGuard implements CanActivate {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * Introspection of the session token at identity-service.
   *
   * @type {VerifySession}
   * @readonly
   */
  private readonly sessions: VerifySession;

  /**
   * Property apiTokens
   *
   * @description
   * Introspection of the personal API token at identity-service.
   *
   * @type {VerifyApiToken}
   * @readonly
   */
  private readonly apiTokens: VerifyApiToken;

  /**
   * Property allowedOrigins
   *
   * @description
   * `ALLOWED_ORIGINS` of the configuration, for the cross-site check of unsafe cookie requests.
   *
   * @type {readonly string[]}
   * @readonly
   */
  private readonly allowedOrigins: readonly string[];

  /**
   * Property reflector
   *
   * @description
   * Reads the `OperationSecurity` of the route.
   *
   * @type {Reflector}
   * @readonly
   */
  private readonly reflector: Reflector;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the introspection use cases, the configuration and the metadata reader.
   *
   * @param {VerifySession} sessions - Introspection of the session token.
   * @param {VerifyApiToken} apiTokens - Introspection of the personal API token.
   * @param {{ readonly ALLOWED_ORIGINS: readonly string[] }} config - Validated configuration of the gateway.
   * @param {Reflector} reflector - NestJS metadata reader.
   * @constructor
   */
  public constructor(
    @Inject(VerifySession) sessions: VerifySession,
    @Inject(VerifyApiToken) apiTokens: VerifyApiToken,
    @Inject(CONFIG) config: { readonly ALLOWED_ORIGINS: readonly string[] },
    @Inject(Reflector) reflector: Reflector,
  ) {
    this.sessions = sessions;
    this.apiTokens = apiTokens;
    this.allowedOrigins = config.ALLOWED_ORIGINS;
    this.reflector = reflector;
  }
  // #endregion

  // #region Methods
  /**
   * Method requires
   *
   * @description
   * Declares the security of the public operation a handler serves, copied from its contract and
   * checked against the shipped specs by the route tests.
   *
   * @param {OperationSecurity} operation - `operationId`, `security` and organization scope.
   * @returns {CustomDecorator} The method decorator.
   */
  public static requires(operation: OperationSecurity): CustomDecorator {
    return SetMetadata(OPERATION_SECURITY, operation);
  }

  /**
   * Method canActivate
   *
   * @description
   * Verifies the credential of the request and gives the request its identity.
   *
   * @param {ExecutionContext} context - Execution context of the request.
   * @returns {Promise<boolean>} `true` when the request may continue.
   * @throws {ProblemException} 401 `auth.session-required`, `auth.session-expired` or
   * `auth.api-token-invalid`; 403 `auth.csrf-rejected`, `auth.api-token-not-accepted`,
   * `organization.mfa-required`, `auth.scope-missing` or `organization.not-selected`; 429 `rate-limit.exceeded` after too many
   * failed bearer tokens from the client address; or 503 `upstream.*` when identity-service cannot
   * answer.
   * @throws {Error} When the handler declares no `OperationSecurity`: a programming error.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const operation: OperationSecurity | undefined = this.reflector.get<
      OperationSecurity | undefined
    >(OPERATION_SECURITY, context.getHandler());
    if (operation === undefined) {
      throw new Error(
        `${context.getClass().name}.${context.getHandler().name} declares no operation security.`,
      );
    }
    if (!needsCredential(operation)) {
      return true;
    }
    if (!credentialIsOptional(operation)) {
      const bearer: BearerToken = readBearerToken(request);
      if (bearer.kind !== 'absent') {
        await this.authenticateApiToken(context, bearer, operation);
        return true;
      }
    }
    await this.authenticateSession(request, operation);
    return true;
  }

  /**
   * Method authenticateApiToken
   *
   * @description
   * Authenticates a request by its personal API token, within the limit of the failed bearer
   * authentications of its client address, then checks that the operation accepts the token and
   * that the token holds its scopes.
   *
   * @param {ExecutionContext} context - Execution context of the request, for `Retry-After`.
   * @param {BearerToken} bearer - The bearer token of the request, present.
   * @param {OperationSecurity} operation - Security of the operation.
   * @returns {Promise<void>} Resolves once the request carries its identity.
   */
  private async authenticateApiToken(
    context: ExecutionContext,
    bearer: BearerToken,
    operation: OperationSecurity,
  ): Promise<void> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const verification: VerifyApiTokenOutput = await this.introspect(() =>
      this.apiTokens.execute({
        token: bearer.kind === 'token' ? bearer.token : null,
        clientAddress: toClientAddress(request),
      }),
    );
    if (verification.outcome === 'throttled') {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', String(verification.retryAfterSeconds));
      throw bearerFailureLimitExceededProblem();
    }
    if (verification.outcome === 'invalid') {
      throw apiTokenInvalidProblem();
    }
    const token: VerifiedApiToken = verification.token;
    const requiredScopes: readonly string[] | undefined = apiTokenScopesOf(operation);
    if (requiredScopes === undefined) {
      throw apiTokenNotAcceptedProblem();
    }
    if (token.withheldOrganization !== undefined) {
      // A code the public contracts do not declare still refuses the token, as its empty scopes
      // would make a gateway that does not read `withheldOrganization` refuse it.
      throw (
        organizationWithheldProblem(token.withheldOrganization) ??
        scopeMissingProblem(requiredScopes)
      );
    }
    if (requiredScopes.some((scope: string) => !token.scopes.includes(scope))) {
      throw scopeMissingProblem(requiredScopes);
    }
    setRequestOrganizationContext(request, {
      organizationId: token.organizationId,
      actor: { type: 'user', id: token.userId },
      role: token.role,
      scopes: token.scopes,
    });
    attachVerifiedCredential(request, {
      kind: 'api-token',
      id: token.apiTokenId,
      userId: token.userId,
    });
  }

  /**
   * Method authenticateSession
   *
   * @description
   * Authenticates a request by its session cookie, after the cross-site check of an unsafe
   * request, then checks the current organization the operation needs: a withheld one first,
   * then a missing one. A withheld organization never reaches the context of the request.
   *
   * @param {Request} request - Incoming request.
   * @param {OperationSecurity} operation - Security of the operation.
   * @returns {Promise<void>} Resolves once the request carries its identity, or none on an
   * operation whose credential is optional.
   */
  private async authenticateSession(request: Request, operation: OperationSecurity): Promise<void> {
    if (!acceptsSession(operation)) {
      throw new Error(`${operation.operationId} accepts no session: no route declares that yet.`);
    }
    const optional: boolean = credentialIsOptional(operation);
    const cookie: ReturnType<typeof readSessionCookie> = readSessionCookie(request);
    if (cookie.kind === 'absent') {
      if (optional) {
        return;
      }
      throw sessionRequiredProblem();
    }
    if (isUnsafeMethod(request.method)) {
      assertCookieRequestSameSite(request, this.allowedOrigins);
    }
    const session: VerifiedSession | null =
      cookie.kind === 'token'
        ? await this.introspect(() => this.sessions.execute(cookie.token))
        : null;
    if (session === null) {
      if (optional) {
        return;
      }
      throw sessionExpiredProblem();
    }
    const withheld: boolean = session.withheldOrganization !== undefined;
    if (operation.organization && session.withheldOrganization !== undefined) {
      // A code the public contracts do not declare still refuses the route, as the missing
      // organization would make a gateway that does not read `withheldOrganization` refuse it.
      throw (
        organizationWithheldProblem(session.withheldOrganization) ??
        organizationNotSelectedProblem()
      );
    }
    if (operation.organization && session.organizationId === null) {
      throw organizationNotSelectedProblem();
    }
    setRequestOrganizationContext(request, {
      organizationId: withheld ? null : session.organizationId,
      actor: { type: 'user', id: session.userId },
      role: withheld ? null : session.role,
      scopes: session.scopes,
    });
    attachVerifiedCredential(request, {
      kind: 'session',
      id: session.sessionId,
      userId: session.userId,
    });
  }

  /**
   * Method introspect
   *
   * @description
   * Runs an introspection and translates a failure for the browser: the introspections declare
   * no client error the applications may see, so a refused internal token (`401`, or `403`
   * refusing the issuer or the actor) answers `503 upstream.unauthorized` and any other client
   * error `503 upstream.failed`, never the internal problem itself.
   *
   * @param {() => Promise<TResult>} call - The introspection.
   * @returns {Promise<TResult>} What the introspection answered.
   * @throws {ProblemException} 503 `upstream.*` when identity-service cannot answer.
   */
  private async introspect<TResult>(call: () => Promise<TResult>): Promise<TResult> {
    try {
      return await call();
    } catch (error) {
      throw toPublicProblem(error, {});
    }
  }
  // #endregion
}
