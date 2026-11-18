import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/**
 * Class ListLists
 *
 * @description
 * Lists the lists of a space. Forwards `GET /internal/v1/spaces/{spaceId}/lists` to task-service, which decides everything about it.
 */
export class ListLists {
  // #region Properties
  /**
   * Property listRegistry
   *
   * @description
   * The lists and sprints of task-service.
   *
   * @type {ListRegistry}
   * @readonly
   */
  private readonly listRegistry: ListRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {ListRegistry} listRegistry - The lists and sprints of task-service.
   * @constructor
   */
  public constructor(listRegistry: ListRegistry) {
    this.listRegistry = listRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Lists the lists of a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.listRegistry.listLists(spaceId, query);
  }
  // #endregion
}
