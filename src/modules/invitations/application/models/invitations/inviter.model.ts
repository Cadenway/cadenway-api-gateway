/**
 * Interface Inviter
 *
 * @description
 * Who sent an invitation ("Invité par {nom}").
 */
export interface Inviter {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Full name of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;
  // #endregion
}
