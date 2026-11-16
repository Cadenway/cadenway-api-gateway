/**
 * Interface CodeSent
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface CodeSent {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * Instant when the challenge expires.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property resendAvailableAt
   *
   * @description
   * Instant when another code can be requested.
   *
   * @type {string}
   * @readonly
   */
  readonly resendAvailableAt: string;
  // #endregion
}
