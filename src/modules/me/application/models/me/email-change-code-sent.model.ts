/**
 * Interface EmailChangeCodeSent
 *
 * @description
 * Answer of identity-service to a change of address: the code is on its way to the new address.
 */
export interface EmailChangeCodeSent {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The new address the code was sent to.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * Instant when the code stops working, 15 minutes later.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property resendAvailableAt
   *
   * @description
   * Instant when another code can be asked for the new address.
   *
   * @type {string}
   * @readonly
   */
  readonly resendAvailableAt: string;
  // #endregion
}
