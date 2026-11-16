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
import type { Request } from 'express';

import { toPublicProblem } from '../../../../../../problems/upstream-problem.js';
import {
  assertSameSiteRequest,
  isUnsafeMethod,
} from '../../validation/session/cross-site.validation.js';
import { readSessionCookie } from '../../../../../../presentation/http/session/session-cookie.js';
import {
  sessionExpiredProblem,
  sessionRequiredProblem,
} from '../../../../../../problems/session-problems.js';
import { attachVerifiedSession } from '../../../../../../presentation/http/session/request-session.js';
import type { VerifiedSession } from '../../../../application/models/session/verified-session.model.js';
import { VerifySession } from '../../../../application/use-cases/queries/session/verify-session/verify-session.use-case.js';

/**
 * Constant SESSION_REQUIREMENT
 *
 * @description
 * Metadata key of `OptionalSession`.
 *
 * @type {string}
 */
const SESSION_REQUIREMENT: string = 'cadenway:session-requirement';

/**
 * Class SessionGuard
 *
 * @description
 * Authenticates a request by its session cookie `__Host-cw_session`, on every request and without
 * a cache: the token is opaque, so it is introspected at identity-service each time, and a revoked
 * session stops at the next request. Known cost: while identity-service is unavailable, so are the
 * routes it guards (`503 upstream.*`).
 *
 * 1. An unsafe request first passes the cross-site check (`403 auth.csrf-rejected`), before any
 *    call: the cookie authenticates it.
 * 2. No cookie answers `401 auth.session-required`. A cookie that cannot be a token, or that the
 *    introspection does not find active, answers `401 auth.session-expired`. On a route marked
 *    `OptionalSession`, both let the route run without an identity. A failed introspection is
 *    `503 upstream.*`, whatever identity-service answered.
 * 3. An active session gives the request its organization context with
 *    `setRequestOrganizationContext` of `@cadenway/nest-common`, from the introspection only: a
 *    user actor, and the organization, role and scopes identity-service returned (no organization
 *    and no scope in version 1.0.0 of the internal contract). The handler reads it with
 *    `getOrganizationContext()`, the internal HTTP client signs the internal token of its calls
 *    from it, and the log lines of the request carry `userId`. The verified session itself (its id
 *    for the sign-out) is kept with `attachVerifiedSession`.
 *
 * A route without a session in its contract (`security: []`) does not use this guard: its cookie,
 * stale or not, is never read.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  // #region Properties
  /**
   * Property introspector
   *
   * @description
   * Introspection of the session token at identity-service.
   *
   * @type {VerifySession}
   * @readonly
   */
  private readonly introspector: VerifySession;

  /**
   * Property allowedOrigins
   *
   * @description
   * `ALLOWED_ORIGINS` of the configuration, for the cross-site check of unsafe requests.
   *
   * @type {readonly string[]}
   * @readonly
   */
  private readonly allowedOrigins: readonly string[];

  /**
   * Property reflector
   *
   * @description
   * Reads the `OptionalSession` marker of the route.
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
   * Receives the introspection port, the configuration and the metadata reader.
   *
   * @param {VerifySession} introspector - Introspection of the session token.
   * @param {{ readonly ALLOWED_ORIGINS: readonly string[] }} config - Validated configuration of the gateway.
   * @param {Reflector} reflector - NestJS metadata reader.
   * @constructor
   */
  public constructor(
    @Inject(VerifySession) introspector: VerifySession,
    @Inject(CONFIG) config: { readonly ALLOWED_ORIGINS: readonly string[] },
    @Inject(Reflector) reflector: Reflector,
  ) {
    this.introspector = introspector;
    this.allowedOrigins = config.ALLOWED_ORIGINS;
    this.reflector = reflector;
  }
  // #endregion

  // #region Methods
  /**
   * Method optional
   *
   * @description
   * Marks a route guarded by `SessionGuard` whose session is optional (`security` lists the cookie
   * and `{}`, as the sign-out does): without a cookie, or with one that is no longer active, the
   * route runs without an identity instead of answering `401`.
   *
   * @returns {CustomDecorator} The method or class decorator.
   */
  public static optional(): CustomDecorator {
    return SetMetadata(SESSION_REQUIREMENT, 'optional');
  }

  /**
   * Method canActivate
   *
   * @description
   * Verifies the session cookie of the request and gives the request its identity.
   *
   * @param {ExecutionContext} context - Execution context of the request.
   * @returns {Promise<boolean>} `true` when the request may continue.
   * @throws {ProblemException} 403 `auth.csrf-rejected`, 401 `auth.session-required`,
   * 401 `auth.session-expired`, or 503 `upstream.*` when identity-service cannot answer.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const optional: boolean =
      this.reflector.getAllAndOverride<string | undefined>(SESSION_REQUIREMENT, [
        context.getHandler(),
        context.getClass(),
      ]) === 'optional';
    if (isUnsafeMethod(request.method)) {
      assertSameSiteRequest(request, this.allowedOrigins);
    }
    const cookie: ReturnType<typeof readSessionCookie> = readSessionCookie(request);
    if (cookie.kind === 'absent') {
      if (optional) {
        return true;
      }
      throw sessionRequiredProblem();
    }
    const session: VerifiedSession | null =
      cookie.kind === 'token' ? await this.introspect(cookie.token) : null;
    if (session === null) {
      if (optional) {
        return true;
      }
      throw sessionExpiredProblem();
    }
    setRequestOrganizationContext(request, {
      organizationId: session.organizationId,
      actor: { type: 'user', id: session.userId },
      role: session.role,
      scopes: session.scopes,
    });
    attachVerifiedSession(request, session);
    return true;
  }

  /**
   * Method introspect
   *
   * @description
   * Introspects the token and translates a failure for the browser: the introspection declares no
   * client error the applications may see, so a refused internal token (`401`, or `403` refusing
   * the issuer or the actor) answers `503 upstream.unauthorized` and any other client error
   * `503 upstream.failed`, never the internal problem itself.
   *
   * @param {string} token - Value of the session cookie.
   * @returns {Promise<VerifiedSession | null>} The session, or `null` when it is not active.
   * @throws {ProblemException} 503 `upstream.*` when identity-service cannot answer.
   */
  private async introspect(token: string): Promise<VerifiedSession | null> {
    try {
      return await this.introspector.execute(token);
    } catch (error) {
      throw toPublicProblem(error, {});
    }
  }
  // #endregion
}
