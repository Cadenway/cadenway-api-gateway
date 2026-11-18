import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/**
 * Class GetList
 *
 * @description
 * Reads a list the actor sees. Forwards `GET /internal/v1/lists/{listId}` to task-service, which decides everything about it.
 */
export class GetList {
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
   * Reads a list the actor sees.
   *
   * @param {string} listId - Id of the list.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(listId: string): Promise<TaskServiceDocument> {
    return this.listRegistry.getList(listId);
  }
  // #endregion
}
