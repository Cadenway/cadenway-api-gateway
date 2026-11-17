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
   * Current organization of the session, chosen with `PUT /v1/session/organization`; `null` when
   * it has none, or when its user no longer belongs to it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly organizationId: string | null;

  /**
   * Property role
   *
   * @description
   * Role of the user in that organization, from the copy of the memberships of identity-service;
   * `null` without an organization.
   *
   * @type {string | null}
   * @readonly
   */
  readonly role: string | null;

  /**
   * Property scopes
   *
   * @description
   * Scopes the session grants: every scope, as the introspection lists them.
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
