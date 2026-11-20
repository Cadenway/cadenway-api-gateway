import type { FavoritesRegistry } from '../../../../ports/outbound/task-service/favorites/favorites-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays getFavorite to task-service. */
export class GetFavorite {
  // #region Properties
  /** The task-service port. */
  private readonly registry: FavoritesRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: FavoritesRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(favoriteId: string): Promise<TaskServiceDocument> {
    return this.registry.getFavorite(favoriteId);
  }
  // #endregion
}
