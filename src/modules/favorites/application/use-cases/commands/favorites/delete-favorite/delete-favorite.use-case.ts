import type { FavoritesRegistry } from '../../../../ports/outbound/task-service/favorites/favorites-registry.port.js';

/** Relays deleteFavorite to task-service. */
export class DeleteFavorite {
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
  public execute(favoriteId: string, ifMatch: string | undefined): Promise<void> {
    return this.registry.deleteFavorite(favoriteId, ifMatch);
  }
  // #endregion
}
