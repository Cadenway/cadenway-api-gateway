import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';

/** Relays deleteSavedView to task-service. */
export class DeleteSavedView {
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
  public execute(listId: string, viewId: string, ifMatch: string | undefined): Promise<void> {
    return this.registry.deleteSavedView(listId, viewId, ifMatch);
  }
  // #endregion
}
