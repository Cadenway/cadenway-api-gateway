import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TrashRegistry } from '../../../../ports/outbound/task-service/trash/trash-registry.port.js';

/**
 * Class RestoreTrashEntry
 *
 * @description
 * Restores a trash entry. Forwards `POST /internal/v1/trash/entries/{entryId}/restore` to task-service, which decides everything about it.
 */
export class RestoreTrashEntry {
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
   * Brings an entry back to its list, its root and every subtask of it.
   *
   * @param {string} entryId - Id of the entry.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    entryId: string,
    body: TaskServiceDocument,
    query: TaskServiceDocument,
  ): Promise<TaskServiceDocument> {
    return this.trashRegistry.restoreTrashEntry(entryId, body, query);
  }
  // #endregion
}
