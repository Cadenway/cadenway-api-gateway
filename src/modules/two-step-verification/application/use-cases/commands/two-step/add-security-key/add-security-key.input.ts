import type { Client } from '../../../../models/two-step/client.model.js';
import type { SecurityKeyAttestation } from '../../../../models/two-step/security-key-attestation.model.js';

/**
 * Interface AddSecurityKeyInput
 *
 * @description
 * The answer of the browser to the pending registration of a security key of the session, and the name of the key.
 */
export interface AddSecurityKeyInput {
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
   * Id of the session (a UUID) whose pending registration is answered.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property name
   *
   * @description
   * Name of the key, as typed; identity-service trims it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property credential
   *
   * @description
   * The answer of the browser. Never logged.
   *
   * @type {SecurityKeyAttestation}
   * @readonly
   */
  readonly credential: SecurityKeyAttestation;

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
