import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class CreateTask
 *
 * @description
 * Creates a task and its subtasks in a list. Forwards `POST /internal/v1/lists/{listId}/tasks` to task-service, which decides everything about it.
 */
export class CreateTask {
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
   * Creates a task and its subtasks in a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    listId: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.taskRegistry.createTask(listId, creation, idempotencyKey);
  }
  // #endregion
}
