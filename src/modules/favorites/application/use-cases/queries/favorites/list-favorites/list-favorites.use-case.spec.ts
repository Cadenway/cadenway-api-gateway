import { describe, expect, it, vi } from 'vitest';
import type { FavoritesRegistry } from '../../../../ports/outbound/task-service/favorites/favorites-registry.port.js';
import { ListFavorites } from './list-favorites.use-case.js';

describe('ListFavorites', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { items: [] };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listFavorites: call } as unknown as FavoritesRegistry;
    await expect(new ListFavorites(registry).execute({ limit: 20 })).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith({ limit: 20 });
  });
});
