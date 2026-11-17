import type { ChangePasswordInput } from './change-password.input.js';
import type { GetCurrentUserOutput } from '../../../queries/me/get-current-user/get-current-user.output.js';
import type { IdentityUsers } from '../../../../ports/outbound/identity/me/identity-users.port.js';

/**
 * Class ChangePassword
 *
 * @description
 * Changes the password of the account of the verified session through Identity, which checks the
 * new password, then the current one, keeps every session open and sends the security email.
 */
export class ChangePassword {
  // #region Properties
  /**
   * Property identity
   *
   * @description
   * The owning capability port for Identity.
   *
   * @type {IdentityUsers}
   * @readonly
   */
  private readonly identity: IdentityUsers;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the Identity port for the application operation.
   *
   * @param {IdentityUsers} identity - Identity capability port.
   * @constructor
   */
  public constructor(identity: IdentityUsers) {
    this.identity = identity;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Changes the password.
   *
   * @param {ChangePasswordInput} input - Account, session, passwords and browser.
   * @returns {Promise<GetCurrentUserOutput>} The account after the change.
   */
  public execute(input: ChangePasswordInput): Promise<GetCurrentUserOutput> {
    return this.identity.changePassword(input);
  }
  // #endregion
}
