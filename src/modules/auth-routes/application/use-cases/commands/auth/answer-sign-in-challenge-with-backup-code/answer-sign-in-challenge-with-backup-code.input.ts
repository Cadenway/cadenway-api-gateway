import type { Client } from '../../../../models/auth/client.model.js';

/**
 * Interface AnswerSignInChallengeWithBackupCodeInput
 *
 * @description
 * The answer of a two-step challenge with a backup code.
 */
export interface AnswerSignInChallengeWithBackupCodeInput {
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
   * The backup code, as typed (`XXXX-XXXX`, any case, with or without the dash). A secret: never logged.
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
