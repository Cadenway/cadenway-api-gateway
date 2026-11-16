/**
 * Interface RequestSession
 *
 * @description
 * Identifiers attached to the HTTP request after session verification.
 */
export interface RequestSession {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * Identifier of the verified session.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property userId
   *
   * @description
   * Identifier of the verified account.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}

/**
 * Constant VERIFIED_SESSIONS
 *
 * @description
 * The verified session of each request, keyed by the request object so that it disappears with
 * it. A `WeakMap` rather than a property: nothing the client sends can name or overwrite it.
 *
 * @type {WeakMap<object, RequestSession>}
 */
const VERIFIED_SESSIONS: WeakMap<object, RequestSession> = new WeakMap<object, RequestSession>();

/**
 * Function attachVerifiedSession
 *
 * @description
 * Keeps the session that the introspection of the request's cookie returned. Only `SessionGuard`
 * calls it, right after the introspection, next to `setRequestOrganizationContext`.
 *
 * @param {object} request - Incoming request.
 * @param {RequestSession} session - Answer of the introspection, active.
 * @throws {Error} When the request already carries a verified session: a programming error.
 */
export function attachVerifiedSession(request: object, session: RequestSession): void {
  if (VERIFIED_SESSIONS.has(request)) {
    throw new Error('attachVerifiedSession: the request already carries a verified session.');
  }
  VERIFIED_SESSIONS.set(
    request,
    Object.freeze({ sessionId: session.sessionId, userId: session.userId }),
  );
}

/**
 * Function verifiedSessionOf
 *
 * @description
 * Reads the verified session of a request.
 *
 * @param {object} request - Incoming request.
 * @returns {RequestSession | undefined} The session `SessionGuard` verified, or `undefined` when
 * the request carries none (no guard, no cookie, or an inactive one on an optional route).
 */
export function verifiedSessionOf(request: object): RequestSession | undefined {
  return VERIFIED_SESSIONS.get(request);
}
