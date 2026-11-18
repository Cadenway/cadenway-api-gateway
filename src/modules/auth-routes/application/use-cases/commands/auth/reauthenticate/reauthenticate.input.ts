/**
 * Interface ReauthenticateInput
 *
 * @description
 * A password confirmed in the session of the request.
 */
export interface ReauthenticateInput {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * Id of the session, as its introspection returned it; never an id the request names.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property password
   *
   * @description
   * The current password of the account. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;
  // #endregion
}
