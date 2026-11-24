import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class ListTasks
 *
 * @description
 * Lists the tasks of a list, filtered and sorted. Forwards `GET /internal/v1/lists/{listId}/tasks` to task-service, which decides everything about it.
 */
export class ListTasks {
  // #region Properties
  /**
   * Property taskRegistry
   *
   * @description
   * The tasks of task-service.
   *
   * @type {TaskRegistry}
   * @readonly
   */
  private readonly taskRegistry: TaskRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {TaskRegistry} taskRegistry - The tasks of task-service.
   * @constructor
   */
  public constructor(taskRegistry: TaskRegistry) {
    this.taskRegistry = taskRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Lists the tasks of a list, filtered and sorted.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    listId: string,
    query: TaskServiceDocument,
    method?: 'QUERY',
  ): Promise<TaskServiceDocument> {
    return method === 'QUERY'
      ? this.taskRegistry.listTasks(listId, query, method)
      : this.taskRegistry.listTasks(listId, query);
  }
  // #endregion
}
