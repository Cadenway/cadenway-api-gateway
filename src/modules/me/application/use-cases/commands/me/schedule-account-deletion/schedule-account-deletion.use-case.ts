import type { ScheduleAccountDeletionInput } from './schedule-account-deletion.input.js';
import type { DeletionScheduled } from '../../../../models/me/deletion-scheduled.model.js';
import type { IdentityUsers } from '../../../../ports/outbound/identity/me/identity-users.port.js';

/**
 * Class ScheduleAccountDeletion
 *
 * @description
 * Schedules the deletion of the account of the verified session through Identity, which refuses it
 * while the person owns an organization, checks the recent authentication of the session, and
 * revokes every session and personal API token of the account at once.
 */
export class ScheduleAccountDeletion {
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
   * Schedules the deletion.
   *
   * @param {ScheduleAccountDeletionInput} input - Account and session.
   * @returns {Promise<DeletionScheduled>} When the account will be deleted.
   */
  public execute(input: ScheduleAccountDeletionInput): Promise<DeletionScheduled> {
    return this.identity.scheduleAccountDeletion(input);
  }
  // #endregion
}
