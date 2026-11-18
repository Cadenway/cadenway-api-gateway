import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class AssignTask
 *
 * @description
 * Assigns a member to a task. Forwards `PUT /internal/v1/tasks/{taskKey}/assignees/{userId}` to task-service, which decides everything about it.
 */
export class AssignTask {
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
   * Assigns a member to a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Id of the account.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    taskKey: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.taskRegistry.assignTask(taskKey, userId, ifMatch);
  }
  // #endregion
}
