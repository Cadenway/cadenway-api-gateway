import type { Client } from '../../../../models/me/client.model.js';

/**
 * Interface ConfirmEmailChangeInput
 *
 * @description
 * The code that confirms the new address of the account of the verified session.
 */
export interface ConfirmEmailChangeInput {
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
   * Id of the session of the request: the pending change belongs to the session that asked for it.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property code
   *
   * @description
   * The 6 digits sent to the new address. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property client
   *
   * @description
   * Browser the address is confirmed in, shown in the notice to the previous address.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
