/**
 * Interface PasswordResetLinkSent
 *
 * @description
 * Answer of identity-service to a password reset request, the same whether or not a link was
 * issued.
 */
export interface PasswordResetLinkSent {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address the link was asked for.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * Instant when a link issued now stops working, 30 minutes later.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property resendAvailableAt
   *
   * @description
   * Instant when another link can be asked for.
   *
   * @type {string}
   * @readonly
   */
  readonly resendAvailableAt: string;
  // #endregion
}
