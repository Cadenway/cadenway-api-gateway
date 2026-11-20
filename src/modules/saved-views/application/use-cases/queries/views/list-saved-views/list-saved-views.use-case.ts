import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays listSavedViews to task-service. */
export class ListSavedViews {
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
  public execute(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.registry.listSavedViews(listId, query);
  }
  // #endregion
}
