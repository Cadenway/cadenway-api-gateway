import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TrashRegistry } from '../../../../ports/outbound/task-service/trash/trash-registry.port.js';

/**
 * Class EmptyTrash
 *
 * @description
 * Empties the trash. Forwards `POST /internal/v1/trash/empty` to task-service, which decides everything about it.
 */
export class EmptyTrash {
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
   * Takes every entry the actor may restore out of the trash, for a job to erase.
   *
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(body: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.trashRegistry.emptyTrash(body);
  }
  // #endregion
}
