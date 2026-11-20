import type { GrantRegistry } from '../../../../ports/outbound/task-service/grants/grant-registry.port.js';

/**
 * Class RemoveListGrant
 *
 * @description
 * Removes the grant of a person on a list. Forwards `DELETE /internal/v1/lists/{listId}/grants/{userId}` to task-service, which decides everything about it.
 */
export class RemoveListGrant {
  // #region Properties
  /**
   * Property grantRegistry
   *
   * @description
   * The grants of the spaces and lists of task-service.
   *
   * @type {GrantRegistry}
   * @readonly
   */
  private readonly grantRegistry: GrantRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {GrantRegistry} grantRegistry - The grants of the spaces and lists of task-service.
   * @constructor
   */
  public constructor(grantRegistry: GrantRegistry) {
    this.grantRegistry = grantRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Removes the grant of a person on a list.
   *
   * @param {string} listId - Id of the list.
   * @param {string} userId - Account of the person.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the list after the change.
   */
  public execute(listId: string, userId: string, ifMatch: string | undefined): Promise<number> {
    return this.grantRegistry.removeListGrant(listId, userId, ifMatch);
  }
  // #endregion
}
