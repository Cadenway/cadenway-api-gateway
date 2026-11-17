/**
 * Interface PasswordResetCompleted
 *
 * @description
 * Outcome of a password reset: nobody is signed in.
 */
export interface PasswordResetCompleted {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account, where the confirmation email goes.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property closedSessionCount
   *
   * @description
   * Sessions the reset closed.
   *
   * @type {number}
   * @readonly
   */
  readonly closedSessionCount: number;
  // #endregion
}
