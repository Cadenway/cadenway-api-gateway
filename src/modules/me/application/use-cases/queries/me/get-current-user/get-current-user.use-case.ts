import type { User } from './get-current-user.output.js';
import type { IdentityUsers } from '../../../../ports/outbound/identity/me/identity-users.port.js';

/**
 * Class GetCurrentUser
 *
 * @description
 * Reads the account identified by the verified session.
 */
export class GetCurrentUser {
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
   * Reads the account identified by the verified session.
   *
   * @param {string} input - Input selected by the presentation boundary.
   * @returns {Promise<User>} The outcome provided by Identity.
   */
  public execute(input: string): Promise<User> {
    return this.identity.getUser(input);
  }
  // #endregion
}
