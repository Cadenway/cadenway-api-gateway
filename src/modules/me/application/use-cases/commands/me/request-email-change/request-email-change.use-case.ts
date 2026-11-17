import type { RequestEmailChangeInput } from './request-email-change.input.js';
import type { EmailChangeCodeSent } from '../../../../models/me/email-change-code-sent.model.js';
import type { IdentityUsers } from '../../../../ports/outbound/identity/me/identity-users.port.js';

/**
 * Class RequestEmailChange
 *
 * @description
 * Asks Identity to change the address of the account of the verified session: Identity checks the
 * recent authentication of the session and sends a code to the new address.
 */
export class RequestEmailChange {
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
   * Asks for the change of address.
   *
   * @param {RequestEmailChangeInput} input - Account, session and new address.
   * @returns {Promise<EmailChangeCodeSent>} When the code expires and when another can be asked
   * for.
   */
  public execute(input: RequestEmailChangeInput): Promise<EmailChangeCodeSent> {
    return this.identity.requestEmailChange(input);
  }
  // #endregion
}
