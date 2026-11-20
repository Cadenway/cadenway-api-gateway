import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TrashRegistry } from '../../../../ports/outbound/task-service/trash/trash-registry.port.js';

/**
 * Class TrashTask
 *
 * @description
 * Moves a task and its subtasks to the trash. Forwards `POST /internal/v1/tasks/{taskKey}/trash` to task-service, which decides everything about it.
 */
export class TrashTask {
  // #region Properties
  /**
   * Property trashRegistry
   *
   * @description
   * The trash of task-service.
   *
   * @type {TrashRegistry}
   * @readonly
   */
  private readonly trashRegistry: TrashRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {TrashRegistry} trashRegistry - The trash of task-service.
   * @constructor
   */
  public constructor(trashRegistry: TrashRegistry) {
    this.trashRegistry = trashRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Moves a task and its subtasks at every level to the trash as one entry.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.trashRegistry.trashTask(taskKey, body, ifMatch);
  }
  // #endregion
}
