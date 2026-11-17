/**
 * Interface InspectPasswordResetLinkInput
 *
 * @description
 * The token of a password reset link, read by the web application from the fragment of the link.
 */
export interface InspectPasswordResetLinkInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the link. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}
