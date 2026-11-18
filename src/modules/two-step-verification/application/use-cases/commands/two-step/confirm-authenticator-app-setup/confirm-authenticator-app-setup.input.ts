import type { Client } from '../../../../models/two-step/client.model.js';

/**
 * Interface ConfirmAuthenticatorAppSetupInput
 *
 * @description
 * A code of the new authenticator app, which confirms the pending setup of the session.
 */
export interface ConfirmAuthenticatorAppSetupInput {
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
   * Id of the session (a UUID) whose pending setup is confirmed.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property code
   *
   * @description
   * The 6 digits the new app shows. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

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
