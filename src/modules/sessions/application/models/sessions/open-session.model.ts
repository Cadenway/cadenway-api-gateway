import type { SessionDevice } from './session-device.model.js';

/**
 * Interface OpenSession
 *
 * @description
 * An open session of the account of the request.
 */
export interface OpenSession {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the session; never its token.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property current
   *
   * @description
   * `true` for the session of the request.
   *
   * @type {boolean}
   * @readonly
   */
  readonly current: boolean;

  /**
   * Property device
   *
   * @description
   * The device the session runs on.
   *
   * @type {SessionDevice}
   * @readonly
   */
  readonly device: SessionDevice;

  /**
   * Property ipAddress
   *
   * @description
   * Address the session was opened from.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property signedInAt
   *
   * @description
   * When the sign-in opened the session.
   *
   * @type {string}
   * @readonly
   */
  readonly signedInAt: string;

  /**
   * Property lastActiveAt
   *
   * @description
   * Last request of the session, recorded at most once a minute.
   *
   * @type {string}
   * @readonly
   */
  readonly lastActiveAt: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}
