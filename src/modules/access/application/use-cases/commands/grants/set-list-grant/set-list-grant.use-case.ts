import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { VersionedGrant } from '../../../../models/grants/versioned-grant.model.js';
import type { GrantRegistry } from '../../../../ports/outbound/task-service/grants/grant-registry.port.js';

/**
 * Class SetListGrant
 *
 * @description
 * Gives or changes the role of a person on a list. Forwards `PUT /internal/v1/lists/{listId}/grants/{userId}` to task-service, which decides everything about it.
 */
export class SetListGrant {
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
   * Gives or changes the role of a person on a list.
   *
   * @param {string} listId - Id of the list.
   * @param {string} userId - Account of the person.
   * @param {TaskServiceDocument} change - The role, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<VersionedGrant>} The grant and the version of the list.
   */
  public execute(
    listId: string,
    userId: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<VersionedGrant> {
    return this.grantRegistry.setListGrant(listId, userId, change, ifMatch);
  }
  // #endregion
}
