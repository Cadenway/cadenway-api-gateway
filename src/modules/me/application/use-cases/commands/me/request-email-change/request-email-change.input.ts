/**
 * Interface RequestEmailChangeInput
 *
 * @description
 * A request to change the address of the account of the verified session.
 */
export interface RequestEmailChangeInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account, as the introspection of the session returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * Id of the session of the request, whose recent authentication identity-service checks and to
   * which the pending change belongs.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property email
   *
   * @description
   * The new address, where the code goes.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}
