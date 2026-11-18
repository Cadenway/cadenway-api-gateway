import type { AddedChecklistItem } from '../../../../models/checklist/added-checklist-item.model.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class AddChecklistItem
 *
 * @description
 * Adds an item to the checklist of a task. Forwards `POST /internal/v1/tasks/{taskKey}/checklist-items` to task-service, which decides everything about it.
 */
export class AddChecklistItem {
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
   * Adds an item to the checklist of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<AddedChecklistItem>} The task and the id of the item.
   */
  public execute(
    taskKey: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<AddedChecklistItem> {
    return this.taskRegistry.addChecklistItem(taskKey, creation, idempotencyKey);
  }
  // #endregion
}
