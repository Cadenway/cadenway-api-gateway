/**
 * Interface User
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface User {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Persisted account identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

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
   * Property language
   *
   * @description
   * Preferred account language.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /**
   * Property version
   *
   * @description
   * Persisted account version.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
