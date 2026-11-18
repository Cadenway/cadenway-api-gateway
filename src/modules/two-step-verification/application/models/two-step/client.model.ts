/**
 * Interface Client
 *
 * @description
 * The browser a change of the two-step verification came from, as the gateway saw it: shown in the security email of the change.
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
   * User agent supplied by the browser, `null` without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;
  // #endregion
}
