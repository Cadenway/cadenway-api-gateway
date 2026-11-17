/**
 * Interface RequestAllowance
 *
 * @description
 * Whether one more request of a credential fits in its quota of the current window.
 */
export interface RequestAllowance {
  // #region Properties
  /**
   * Property allowed
   *
   * @description
   * `true` when the request was counted within the quota.
   *
   * @type {boolean}
   * @readonly
   */
  readonly allowed: boolean;

  /**
   * Property retryAfterSeconds
   *
   * @description
   * Whole seconds, at least 1, until the window of a refused credential ends; `0` for an allowed
   * request.
   *
   * @type {number}
   * @readonly
   */
  readonly retryAfterSeconds: number;
  // #endregion
}
