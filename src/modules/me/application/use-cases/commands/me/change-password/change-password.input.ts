import type { Client } from '../../../../models/me/client.model.js';

/**
 * Interface ChangePasswordInput
 *
 * @description
 * A change of the password of the account of the verified session.
 */
export interface ChangePasswordInput {
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
   * Id of the session of the request, as its introspection returned it: the right current
   * password authenticates it again.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property currentPassword
   *
   * @description
   * "Mot de passe actuel". A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly currentPassword: string;

  /**
   * Property newPassword
   *
   * @description
   * The new password, checked by identity-service. A secret: never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly newPassword: string;

  /**
   * Property client
   *
   * @description
   * Browser the password is changed in, shown in the email.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;
  // #endregion
}
