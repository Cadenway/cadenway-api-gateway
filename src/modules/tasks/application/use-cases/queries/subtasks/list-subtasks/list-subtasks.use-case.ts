import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class ListSubtasks
 *
 * @description
 * Lists the direct subtasks of a task. Forwards `GET /internal/v1/tasks/{taskKey}/subtasks` to task-service, which decides everything about it.
 */
export class ListSubtasks {
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
   * Lists the direct subtasks of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.taskRegistry.listSubtasks(taskKey, query);
  }
  // #endregion
}
