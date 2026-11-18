import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/**
 * Class GetListCounts
 *
 * @description
 * Counts the tasks of a list, on the `today` of the caller. Forwards `GET /internal/v1/lists/{listId}/counts` to task-service, which decides everything about it.
 */
export class GetListCounts {
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
   * Counts the tasks of a list, on the `today` of the caller.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.listRegistry.getListCounts(listId, query);
  }
  // #endregion
}
