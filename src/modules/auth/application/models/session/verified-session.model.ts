/**
 * Interface VerifiedSession
 *
 * @description
 * What identity-service answered for an active session cookie, as `SessionGuard` keeps it on the
 * request: the only source of the identity of a request authenticated by the cookie. Nothing here
 * is read from the request itself.
 */
export interface VerifiedSession {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * Id of the session (a UUID), not its token: what the sign-out revokes.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property userId
   *
   * @description
   * Id of the signed-in account (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property organizationId
   *
   * @description
   * Organization of the session. Always `null` in version 1.0.0 of the internal contract: a session
   * belongs to an organization once the organization selection exists.
   *
   * @type {string | null}
   * @readonly
   */
  readonly organizationId: string | null;

  /**
   * Property role
   *
   * @description
   * Member role in that organization; always `null` in version 1.0.0 of the internal contract.
   *
   * @type {string | null}
   * @readonly
   */
  readonly role: string | null;

  /**
   * Property scopes
   *
   * @description
   * Scopes the session grants; empty in version 1.0.0 of the internal contract.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest, as an ISO 8601 instant.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}
