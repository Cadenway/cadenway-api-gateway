/**
 * Interface PasswordResetLink
 *
 * @description
 * A usable password reset link, as identity-service reads it without using it.
 */
export interface PasswordResetLink {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account of the link.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * Instant when the link stops working.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property sessionCount
   *
   * @description
   * Open sessions of the account, which the reset closes unless the person unticks it.
   *
   * @type {number}
   * @readonly
   */
  readonly sessionCount: number;
  // #endregion
}
