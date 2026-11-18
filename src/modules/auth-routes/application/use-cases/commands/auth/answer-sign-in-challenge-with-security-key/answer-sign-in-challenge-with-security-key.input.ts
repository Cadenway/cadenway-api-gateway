import type { Client } from '../../../../models/auth/client.model.js';
import type { SecurityKeyAssertion } from '../../../../models/auth/security-key-assertion.model.js';

/**
 * Interface AnswerSignInChallengeWithSecurityKeyInput
 *
 * @description
 * The answer of a two-step challenge with a security key.
 */
export interface AnswerSignInChallengeWithSecurityKeyInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the challenge, as its `202` gave it. A secret: never logged, never in a URL.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property credential
   *
   * @description
   * The answer of the key, as the browser serialized it. Never logged.
   *
   * @type {SecurityKeyAssertion}
   * @readonly
   */
  readonly credential: SecurityKeyAssertion;

  /**
   * Property trustDevice
   *
   * @description
   * Whether the browser becomes a trusted device of the account for 30 days.
   *
   * @type {boolean}
   * @readonly
   */
  readonly trustDevice: boolean;

  /**
   * Property client
   *
   * @description
   * Browser for which the session is opened, shown in its security emails.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
