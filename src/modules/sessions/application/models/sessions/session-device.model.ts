/**
 * Interface SessionDevice
 *
 * @description
 * The device a session runs on, as identity-service reads it from the `User-Agent` of its sign-in.
 */
export interface SessionDevice {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * `desktop`, `mobile`, `tablet` or `unknown` today; more later.
   *
   * @type {string}
   * @readonly
   */
  readonly type: string;

  /**
   * Property browser
   *
   * @description
   * Name of the browser or client, `null` when it cannot be read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly browser: string | null;

  /**
   * Property browserVersion
   *
   * @description
   * Major version of the browser, `null` when it cannot be read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly browserVersion: string | null;

  /**
   * Property os
   *
   * @description
   * Name of the operating system, `null` when it cannot be read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly os: string | null;

  /**
   * Property osVersion
   *
   * @description
   * Version of the operating system, `null` when the `User-Agent` does not tell it reliably.
   *
   * @type {string | null}
   * @readonly
   */
  readonly osVersion: string | null;
  // #endregion
}
