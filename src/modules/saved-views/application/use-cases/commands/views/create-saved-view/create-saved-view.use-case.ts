import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays createSavedView to task-service. */
export class CreateSavedView {
  // #region Properties
  /** The task-service port. */
  private readonly registry: SavedViewsRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: SavedViewsRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(
    listId: string,
    body: TaskServiceDocument,
    key: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.registry.createSavedView(listId, body, key);
  }
  // #endregion
}
