/**
 * Interface ScheduleAccountDeletionInput
 *
 * @description
 * The deletion of the account of the verified session.
 */
export interface ScheduleAccountDeletionInput {
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
   * Id of the session of the request, whose recent authentication identity-service checks; it is
   * revoked with the others.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
