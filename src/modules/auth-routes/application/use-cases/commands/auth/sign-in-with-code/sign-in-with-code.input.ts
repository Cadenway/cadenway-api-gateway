import type { Client } from '../../../../models/auth/client.model.js';

/**
 * Interface CodeVerification
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface CodeVerification {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property code
   *
   * @description
   * One-time proof, kept out of logs.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property rememberMe
   *
   * @description
   * Whether the session survives the browser.
   *
   * @type {boolean}
   * @readonly
   */
  readonly rememberMe?: boolean;

  /**
   * Property client
   *
   * @description
   * Browser for which the session is opened.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
