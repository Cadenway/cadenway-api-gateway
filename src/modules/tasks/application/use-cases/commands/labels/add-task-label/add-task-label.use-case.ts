import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class AddTaskLabel
 *
 * @description
 * Adds a label to a task. Forwards `POST /internal/v1/tasks/{taskKey}/labels/add` to task-service, which decides everything about it.
 */
export class AddTaskLabel {
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
   * Adds a label to a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} change - The label, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    taskKey: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.taskRegistry.addTaskLabel(taskKey, change, ifMatch);
  }
  // #endregion
}
