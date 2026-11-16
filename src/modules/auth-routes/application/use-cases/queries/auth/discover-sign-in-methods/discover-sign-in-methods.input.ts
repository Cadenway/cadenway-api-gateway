/**
 * Interface DiscoverSignInMethodsInput
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface DiscoverSignInMethodsInput {
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
  // #endregion
}
