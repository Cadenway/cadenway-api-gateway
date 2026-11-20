import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ArchiveRegistry } from '../../../../ports/outbound/task-service/archives/archive-registry.port.js';

/**
 * Class ArchiveList
 *
 * @description
 * Archives a list or a sprint. Forwards `POST /internal/v1/lists/{listId}/archive` to task-service, which decides everything about it.
 */
export class ArchiveList {
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
   * Archives a list or a sprint.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    listId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.archiveRegistry.archiveList(listId, body, ifMatch);
  }
  // #endregion
}
