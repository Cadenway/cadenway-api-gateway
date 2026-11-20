import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TrashRegistry } from '../../../../ports/outbound/task-service/trash/trash-registry.port.js';

/**
 * Class ListTrash
 *
 * @description
 * Lists the trash. Forwards `GET /internal/v1/trash/entries` to task-service, which decides everything about it.
 */
export class ListTrash {
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
   * Lists the entries of the trash the actor may restore, the most recently deleted first.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.trashRegistry.listTrash(query);
  }
  // #endregion
}
