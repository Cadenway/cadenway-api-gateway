import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class UpdateChecklistItem
 *
 * @description
 * Ticks or unticks an item of the checklist of a task. Forwards `PATCH /internal/v1/tasks/{taskKey}/checklist-items/{checklistItemId}` to task-service, which decides everything about it.
 */
export class UpdateChecklistItem {
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
   * Ticks or unticks an item of the checklist of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} checklistItemId - Id of the checklist item.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    taskKey: string,
    checklistItemId: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.taskRegistry.updateChecklistItem(taskKey, checklistItemId, patch, ifMatch);
  }
  // #endregion
}
