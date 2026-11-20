import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Favorite operations provided by task-service. */
export interface FavoritesRegistry {
  // #region Methods
  /** Relays listFavorites to task-service. */
  listFavorites(query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /** Relays createFavorite to task-service. */
  createFavorite(body: TaskServiceDocument, key: string | undefined): Promise<TaskServiceDocument>;

  /** Relays getFavorite to task-service. */
  getFavorite(favoriteId: string): Promise<TaskServiceDocument>;

  /** Relays deleteFavorite to task-service. */
  deleteFavorite(favoriteId: string, ifMatch: string | undefined): Promise<void>;
  // #endregion
}
