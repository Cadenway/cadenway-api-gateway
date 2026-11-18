import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class GetHome
 *
 * @description
 * Reads the task part of "Accueil" for the user of the context. Forwards `GET /internal/v1/users/{userId}/home` to task-service, which decides everything about it.
 */
export class GetHome {
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
   * Reads the task part of "Accueil" for the user of the context.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(userId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.taskRegistry.getHome(userId, query);
  }
  // #endregion
}
