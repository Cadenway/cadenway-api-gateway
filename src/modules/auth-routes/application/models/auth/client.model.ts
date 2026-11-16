/**
 * Interface Client
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface Client {
  // #region Properties
  /**
   * Property ipAddress
   *
   * @description
   * Address supplied by the trusted HTTP edge.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property userAgent
   *
   * @description
   * User agent supplied by the browser, if any.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;
  // #endregion
}
