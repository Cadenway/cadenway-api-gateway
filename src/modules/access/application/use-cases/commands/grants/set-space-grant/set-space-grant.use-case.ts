import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { VersionedGrant } from '../../../../models/grants/versioned-grant.model.js';
import type { GrantRegistry } from '../../../../ports/outbound/task-service/grants/grant-registry.port.js';

/**
 * Class SetSpaceGrant
 *
 * @description
 * Gives or changes the role of a person on a space. Forwards `PUT /internal/v1/spaces/{spaceId}/grants/{userId}` to task-service, which decides everything about it.
 */
export class SetSpaceGrant {
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
   * Gives or changes the role of a person on a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string} userId - Account of the person.
   * @param {TaskServiceDocument} change - The role, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<VersionedGrant>} The grant and the version of the space.
   */
  public execute(
    spaceId: string,
    userId: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<VersionedGrant> {
    return this.grantRegistry.setSpaceGrant(spaceId, userId, change, ifMatch);
  }
  // #endregion
}
