import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class UnassignTask
 *
 * @description
 * Unassigns a member from a task. Forwards `DELETE /internal/v1/tasks/{taskKey}/assignees/{userId}` to task-service, which decides everything about it.
 */
export class UnassignTask {
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
   * Unassigns a member from a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Id of the account.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the task after the change.
   */
  public execute(taskKey: string, userId: string, ifMatch: string | undefined): Promise<number> {
    return this.taskRegistry.unassignTask(taskKey, userId, ifMatch);
  }
  // #endregion
}
