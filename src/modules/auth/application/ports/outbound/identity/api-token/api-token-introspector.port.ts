import type { VerifiedApiToken } from '../../../../models/api-token/verified-api-token.model.js';

/**
 * Interface ApiTokenIntrospector
 *
 * @description
 * Outgoing port of the credential guard for a bearer token: asks identity-service whether a
 * personal API token is active. Implemented by the identity-service client of `src/clients/` with
 * `POST /internal/v1/api-tokens/introspect`, as the actor `system`.
 */
export interface ApiTokenIntrospector {
  // #region Methods
  /**
   * Method introspect
   *
   * @description
   * Introspects a personal API token, on every call: the answer is never cached, so a revoked
   * token, or one whose user left its organization, stops at the next request.
   *
   * @param {string} token - Value of the bearer token. A secret, never logged.
   * @returns {Promise<VerifiedApiToken | null>} The token when it is active, `null` when it is
   * unknown, expired, revoked, malformed, not a personal token, or its user no longer belongs to
   * its organization.
   * @throws {ProblemException} 503 `upstream.*` when identity-service cannot answer.
   */
  introspect(token: string): Promise<VerifiedApiToken | null>;
  // #endregion
}
