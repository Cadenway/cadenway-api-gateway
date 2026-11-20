import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { FavoritesRegistry } from '../../../application/ports/outbound/task-service/favorites/favorites-registry.port.js';

/** Binds the port to the validating task-service client. */
export function createFavoritesRegistry(client: TaskServiceClient): FavoritesRegistry {
  return {
    listFavorites: (query) => client.listFavorites(query),
    createFavorite: (body, key) => client.createFavorite(body, key),
    getFavorite: (favoriteId) => client.getFavorite(favoriteId),
    deleteFavorite: (favoriteId, ifMatch) => client.deleteFavorite(favoriteId, ifMatch),
  };
}
