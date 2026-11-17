import type { UpdateCurrentUserInput } from './update-current-user.input.js';
import type { UpdateCurrentUserOutput } from './update-current-user.output.js';
import type { IdentityUsers } from '../../../../ports/outbound/identity/me/identity-users.port.js';

/**
 * Class UpdateCurrentUser
 *
 * @description
 * Changes the profile of the account of the verified session through Identity, which checks the
 * values and the version and emits `user.profile-updated.v1` when something changed.
 */
export class UpdateCurrentUser {
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
   * Applies the change to the account of the session.
   *
   * @param {UpdateCurrentUserInput} input - Account, changes and `If-Match`.
   * @returns {Promise<UpdateCurrentUserOutput>} The account after the change.
   */
  public execute(input: UpdateCurrentUserInput): Promise<UpdateCurrentUserOutput> {
    return this.identity.updateUser(input.userId, input.changes, input.ifMatch);
  }
  // #endregion
}
