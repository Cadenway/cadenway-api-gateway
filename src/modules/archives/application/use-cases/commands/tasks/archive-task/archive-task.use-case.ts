import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ArchiveRegistry } from '../../../../ports/outbound/task-service/archives/archive-registry.port.js';

/**
 * Class ArchiveTask
 *
 * @description
 * Archives a task and its subtasks at every level. Forwards `POST /internal/v1/tasks/{taskKey}/archive` to task-service, which decides everything about it.
 */
export class ArchiveTask {
  // #region Properties
  /**
   * Property archiveRegistry
   *
   * @description
   * The archived lists and tasks of task-service.
   *
   * @type {ArchiveRegistry}
   * @readonly
   */
  private readonly archiveRegistry: ArchiveRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {ArchiveRegistry} archiveRegistry - The archived lists and tasks of task-service.
   * @constructor
   */
  public constructor(archiveRegistry: ArchiveRegistry) {
    this.archiveRegistry = archiveRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Archives a task and its subtasks at every level.
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
    return this.archiveRegistry.archiveTask(taskKey, body, ifMatch);
  }
  // #endregion
}
