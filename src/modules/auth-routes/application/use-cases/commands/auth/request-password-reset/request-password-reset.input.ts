import type { Client } from '../../../../models/auth/client.model.js';

/**
 * Interface RequestPasswordResetInput
 *
 * @description
 * A request for a password reset link, made without a session.
 */
export interface RequestPasswordResetInput {
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
   * Property client
   *
   * @description
   * Browser that asks for the link, shown in the email.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
