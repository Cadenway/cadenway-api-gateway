import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class GetTask
 *
 * @description
 * Reads a task the actor sees. Forwards `GET /internal/v1/tasks/{taskKey}` to task-service, which decides everything about it.
 */
export class GetTask {
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
   * Reads a task the actor sees.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(taskKey: string): Promise<TaskServiceDocument> {
    return this.taskRegistry.getTask(taskKey);
  }
  // #endregion
}
