import type { Client } from './client.model.js';

/**
 * Interface AccountChange
 *
 * @description
 * A change of the two-step verification of the account of a request: the account and the session the introspection returned, and the browser the security email shows.
 */
export interface AccountChange {
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
   * Property sessionId
   *
   * @description
   * Id of the session (a UUID), whose recent authentication identity-service checks.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property client
   *
   * @description
   * The browser of the change.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
