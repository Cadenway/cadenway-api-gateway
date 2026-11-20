import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { GrantRegistry } from '../../../../ports/outbound/task-service/grants/grant-registry.port.js';

/**
 * Class ListSpaceGrants
 *
 * @description
 * Lists the grants of a space. Forwards `GET /internal/v1/spaces/{spaceId}/grants` to task-service, which decides everything about it.
 */
export class ListSpaceGrants {
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
   * Lists the grants of a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} One page of grants, as task-service answered it.
   */
  public execute(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.grantRegistry.listSpaceGrants(spaceId, query);
  }
  // #endregion
}
