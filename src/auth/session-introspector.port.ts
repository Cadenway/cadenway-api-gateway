import type { VerifiedSession } from './verified-session.js';

/**
 * Interface SessionIntrospector
 *
 * @description
 * Outgoing port of `SessionGuard`: asks identity-service whether the token of a session cookie is
 * active. Implemented by the identity-service client of `src/clients/` with
 * `POST /internal/v1/tokens/introspect`, as the actor `system`.
 */
export interface SessionIntrospector {
  // #region Methods
  /**
   * Method introspect
   *
   * @description
   * Introspects a session token, on every call: the answer is never cached, so a revoked session
   * stops at the next request. An active answer counts as activity of the session at
   * identity-service.
   *
   * @param {string} token - Value of the session cookie, 1 to 256 characters. A secret, never
   * logged.
   * @returns {Promise<VerifiedSession | null>} The session when the token is an active session
   * token, `null` when it is unknown, expired, revoked, malformed or not a session token.
   * @throws {ProblemException} 503 `upstream.*` when identity-service cannot answer.
   */
  introspect(token: string): Promise<VerifiedSession | null>;
  // #endregion
}

/**
 * Constant SESSION_INTROSPECTOR
 *
 * @description
 * Injection token of the `SessionIntrospector`, provided globally by `ClientsModule`.
 *
 * @type {unique symbol}
 */
export const SESSION_INTROSPECTOR: unique symbol = Symbol('SessionIntrospector');
