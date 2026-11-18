/**
 * Interface AccountSession
 *
 * @description
 * The account and the session of a request, as its introspection returned them: never ids the request names.
 */
export interface AccountSession {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * Id of the session (a UUID), whose recent authentication identity-service checks and which a pending setup or registration belongs to.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
