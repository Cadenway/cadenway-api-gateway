/**
 * Interface SignUpRequest
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface SignUpRequest {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Display name supplied by the caller.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

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
   * Property password
   *
   * @description
   * Password supplied by the caller, kept out of logs.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;

  /**
   * Property acceptTerms
   *
   * @description
   * Whether the caller accepted the terms.
   *
   * @type {boolean}
   * @readonly
   */
  readonly acceptTerms: boolean;
  // #endregion
}
