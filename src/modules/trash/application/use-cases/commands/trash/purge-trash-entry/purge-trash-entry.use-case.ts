import type { TrashRegistry } from '../../../../ports/outbound/task-service/trash/trash-registry.port.js';

/**
 * Class PurgeTrashEntry
 *
 * @description
 * Erases a trash entry for good. Forwards `DELETE /internal/v1/trash/entries/{entryId}` to task-service, which decides everything about it.
 */
export class PurgeTrashEntry {
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
   * Erases an entry at once, its root and every subtask of it.
   *
   * @param {string} entryId - Id of the entry.
   * @returns {Promise<void>} Once the entry is erased.
   */
  public execute(entryId: string): Promise<void> {
    return this.trashRegistry.purgeTrashEntry(entryId);
  }
  // #endregion
}
