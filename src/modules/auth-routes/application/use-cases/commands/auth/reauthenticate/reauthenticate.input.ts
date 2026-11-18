/**
 * Interface ReauthenticateInput
 *
 * @description
 * A password, or a code of the authenticator app, confirmed in the session of the request.
 * identity-service decides which one the account needs: both or neither answer
 * `400 request.invalid`.
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
   * The current password of an account without two-step verification, when the browser sent
   * one. A secret: never logged.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly password?: string;

  /**
   * Property code
   *
   * @description
   * The 6 digits the authenticator app of an account with two-step verification shows, when the
   * browser sent them. A secret: never logged.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly code?: string;
  // #endregion
}
