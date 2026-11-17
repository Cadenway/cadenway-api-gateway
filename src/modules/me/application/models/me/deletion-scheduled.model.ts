/**
 * Interface DeletionScheduled
 *
 * @description
 * A scheduled deletion of the account: every session and personal API token of the account is
 * revoked at once.
 */
export interface DeletionScheduled {
  // #region Properties
  /**
   * Property deleteAt
   *
   * @description
   * Instant when the account will be deleted, unless a sign-in cancels it first.
   *
   * @type {string}
   * @readonly
   */
  readonly deleteAt: string;
  // #endregion
}
