import type { Client } from '../../../../models/auth/client.model.js';

/**
 * Interface ConfirmPasswordResetInput
 *
 * @description
 * A new password chosen with a reset link, without a session.
 */
export interface ConfirmPasswordResetInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the link. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property newPassword
   *
   * @description
   * The new password, checked by Identity. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly newPassword: string;

  /**
   * Property closeOtherSessions
   *
   * @description
   * Whether every open session of the account is closed ("Fermer mes autres sessions").
   *
   * @type {boolean}
   * @readonly
   */
  readonly closeOtherSessions: boolean;

  /**
   * Property client
   *
   * @description
   * Browser the new password is chosen in, shown in the email.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
