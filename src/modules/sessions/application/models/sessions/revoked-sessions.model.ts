/**
 * Interface RevokedSessions
 *
 * @description
 * Outcome of closing every other session of the account.
 */
export interface RevokedSessions {
  // #region Properties
  /**
   * Property revokedCount
   *
   * @description
   * Sessions closed by the request.
   *
   * @type {number}
   * @readonly
   */
  readonly revokedCount: number;
  // #endregion
}
