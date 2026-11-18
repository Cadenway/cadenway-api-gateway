import type { Client } from '../../../../models/auth/client.model.js';

/**
 * Interface AnswerSignInChallengeWithAuthenticatorAppInput
 *
 * @description
 * The answer of a two-step challenge with a code of the authenticator app.
 */
export interface AnswerSignInChallengeWithAuthenticatorAppInput {
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
   * Property code
   *
   * @description
   * The 6 digits the app shows. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

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
