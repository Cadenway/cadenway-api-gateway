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

/**
 * Constant VERIFIED_SESSIONS
 *
 * @description
 * The verified session of each request, keyed by the request object so that it disappears with
 * it. A `WeakMap` rather than a property: nothing the client sends can name or overwrite it.
 *
 * @type {WeakMap<object, VerifiedSession>}
 */
const VERIFIED_SESSIONS: WeakMap<object, VerifiedSession> = new WeakMap<object, VerifiedSession>();

/**
 * Function attachVerifiedSession
 *
 * @description
 * Keeps the session that the introspection of the request's cookie returned. Only `SessionGuard`
 * calls it, right after the introspection, next to `setRequestOrganizationContext`.
 *
 * @param {object} request - Incoming request.
 * @param {VerifiedSession} session - Answer of the introspection, active.
 * @throws {Error} When the request already carries a verified session: a programming error.
 */
export function attachVerifiedSession(request: object, session: VerifiedSession): void {
  if (VERIFIED_SESSIONS.has(request)) {
    throw new Error('attachVerifiedSession: the request already carries a verified session.');
  }
  VERIFIED_SESSIONS.set(request, Object.freeze({ ...session, scopes: [...session.scopes] }));
}

/**
 * Function verifiedSessionOf
 *
 * @description
 * Reads the verified session of a request.
 *
 * @param {object} request - Incoming request.
 * @returns {VerifiedSession | undefined} The session `SessionGuard` verified, or `undefined` when
 * the request carries none (no guard, no cookie, or an inactive one on an optional route).
 */
export function verifiedSessionOf(request: object): VerifiedSession | undefined {
  return VERIFIED_SESSIONS.get(request);
}
