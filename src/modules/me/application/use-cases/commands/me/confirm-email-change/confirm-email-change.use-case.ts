import type { ConfirmEmailChangeInput } from './confirm-email-change.input.js';
import type { GetCurrentUserOutput } from '../../../queries/me/get-current-user/get-current-user.output.js';
import type { IdentityUsers } from '../../../../ports/outbound/identity/me/identity-users.port.js';

/**
 * Class ConfirmEmailChange
 *
 * @description
 * Confirms the new address of the account of the verified session with its code, through
 * Identity, which makes it the verified address of the account.
 */
export class ConfirmEmailChange {
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
   * Confirms the new address.
   *
   * @param {ConfirmEmailChangeInput} input - Account, session, code and browser.
   * @returns {Promise<GetCurrentUserOutput>} The account with its new address.
   */
  public execute(input: ConfirmEmailChangeInput): Promise<GetCurrentUserOutput> {
    return this.identity.confirmEmailChange(input);
  }
  // #endregion
}
