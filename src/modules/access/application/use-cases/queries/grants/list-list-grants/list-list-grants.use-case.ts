import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { GrantRegistry } from '../../../../ports/outbound/task-service/grants/grant-registry.port.js';

/**
 * Class ListListGrants
 *
 * @description
 * Lists the grants of a list. Forwards `GET /internal/v1/lists/{listId}/grants` to task-service, which decides everything about it.
 */
export class ListListGrants {
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
   * Lists the grants of a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} One page of grants, as task-service answered it.
   */
  public execute(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.grantRegistry.listListGrants(listId, query);
  }
  // #endregion
}
