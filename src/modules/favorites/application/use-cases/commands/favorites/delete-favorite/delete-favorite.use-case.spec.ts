import { describe, expect, it, vi } from 'vitest';
import type { FavoritesRegistry } from '../../../../ports/outbound/task-service/favorites/favorites-registry.port.js';
import { DeleteFavorite } from './delete-favorite.use-case.js';

describe('DeleteFavorite', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = undefined;
    const call = vi.fn().mockResolvedValue(result);
    const registry = { deleteFavorite: call } as unknown as FavoritesRegistry;
    await expect(new DeleteFavorite(registry).execute('favorite', '"1"')).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('favorite', '"1"');
  });
});
