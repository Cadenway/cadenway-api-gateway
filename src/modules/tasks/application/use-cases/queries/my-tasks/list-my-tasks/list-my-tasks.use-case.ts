import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class ListMyTasks
 *
 * @description
 * Lists the tasks of the user of the context ("Mes tâches"). Forwards `GET /internal/v1/users/{userId}/tasks` to task-service, which decides everything about it.
 */
export class ListMyTasks {
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
   * Lists the tasks of the user of the context ("Mes tâches").
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(userId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.taskRegistry.listMyTasks(userId, query);
  }
  // #endregion
}
