/**
 * Interface RecentAuthentication
 *
 * @description
 * The window of recent authentication of a session, opened by a confirmed password.
 */
export interface RecentAuthentication {
  // #region Properties
  /**
   * Property authenticatedAt
   *
   * @description
   * Instant when the person last proved who they are in the session.
   *
   * @type {string}
   * @readonly
   */
  readonly authenticatedAt: string;

  /**
   * Property expiresAt
   *
   * @description
   * Instant when the window ends, 10 minutes later.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}
