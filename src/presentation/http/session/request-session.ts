/**
 * Interface RequestCredential
 *
 * @description
 * The credential the authentication of a request verified, attached to the HTTP request by the
 * guard that verified it: a session (its cookie) or a personal API token (its bearer). Its `id`
 * is the id identity-service returned, never the secret: the rate limit counts requests on it.
 */
export interface RequestCredential {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * `session` for the session cookie, `api-token` for a personal API token.
   *
   * @type {'session' | 'api-token'}
   * @readonly
   */
  readonly kind: 'session' | 'api-token';

  /**
   * Property id
   *
   * @description
   * Id of the session or of the personal API token (a UUID), as the introspection returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * Id of the account the credential acts for (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}

/**
 * Interface RequestSession
 *
 * @description
 * The session of a request authenticated by the session cookie: what the sign-out revokes and
 * what the choice of the current organization moves.
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
 * Constant VERIFIED_CREDENTIALS
 *
 * @description
 * The verified credential of each request, keyed by the request object so that it disappears with
 * it. A `WeakMap` rather than a property: nothing the client sends can name or overwrite it.
 *
 * @type {WeakMap<object, RequestCredential>}
 */
const VERIFIED_CREDENTIALS: WeakMap<object, RequestCredential> = new WeakMap<
  object,
  RequestCredential
>();

/**
 * Function attachVerifiedCredential
 *
 * @description
 * Keeps the credential that the introspection of the request returned. Only the credential guard
 * of `src/modules/auth/` calls it, right after the introspection, next to
 * `setRequestOrganizationContext`.
 *
 * @param {object} request - Incoming request.
 * @param {RequestCredential} credential - The verified credential.
 * @throws {Error} When the request already carries a verified credential: a programming error.
 */
export function attachVerifiedCredential(request: object, credential: RequestCredential): void {
  if (VERIFIED_CREDENTIALS.has(request)) {
    throw new Error('attachVerifiedCredential: the request already carries a verified credential.');
  }
  VERIFIED_CREDENTIALS.set(
    request,
    Object.freeze({ kind: credential.kind, id: credential.id, userId: credential.userId }),
  );
}

/**
 * Function verifiedCredentialOf
 *
 * @description
 * Reads the verified credential of a request.
 *
 * @param {object} request - Incoming request.
 * @returns {RequestCredential | undefined} The credential the guard verified, or `undefined` when
 * the request carries none (a route without a credential, or an optional session that is absent
 * or no longer active).
 */
export function verifiedCredentialOf(request: object): RequestCredential | undefined {
  return VERIFIED_CREDENTIALS.get(request);
}

/**
 * Function verifiedSessionOf
 *
 * @description
 * Reads the verified session of a request authenticated by the session cookie.
 *
 * @param {object} request - Incoming request.
 * @returns {RequestSession | undefined} The session, or `undefined` when the request carries no
 * verified session (no credential, or a personal API token).
 */
export function verifiedSessionOf(request: object): RequestSession | undefined {
  const credential: RequestCredential | undefined = VERIFIED_CREDENTIALS.get(request);
  return credential?.kind === 'session'
    ? { sessionId: credential.id, userId: credential.userId }
    : undefined;
}
