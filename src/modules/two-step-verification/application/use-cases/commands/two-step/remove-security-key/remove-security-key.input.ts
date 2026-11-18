import type { Client } from '../../../../models/two-step/client.model.js';

/**
 * Interface RemoveSecurityKeyInput
 *
 * @description
 * A security key to remove from the account of the request.
 */
export interface RemoveSecurityKeyInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account (a UUID), as the introspection returned it.
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
   * Property securityKeyId
   *
   * @description
   * Id of the key (a UUID), from the public path.
   *
   * @type {string}
   * @readonly
   */
  readonly securityKeyId: string;

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
