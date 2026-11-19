import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ArchiveRegistry } from '../../../../ports/outbound/task-service/archives/archive-registry.port.js';

/**
 * Class ListArchivedTasks
 *
 * @description
 * Lists the roots of the archived subtrees the actor sees. Forwards `GET /internal/v1/archives/tasks` to task-service, which decides everything about it.
 */
export class ListArchivedTasks {
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
   * Lists the roots of the archived subtrees the actor sees.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.archiveRegistry.listArchivedTasks(query);
  }
  // #endregion
}
