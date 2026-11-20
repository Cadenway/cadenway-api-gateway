import { describe, expect, it, vi } from 'vitest';
import type { FavoritesRegistry } from '../../../../ports/outbound/task-service/favorites/favorites-registry.port.js';
import { GetFavorite } from './get-favorite.use-case.js';

describe('GetFavorite', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'favorite' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { getFavorite: call } as unknown as FavoritesRegistry;
    await expect(new GetFavorite(registry).execute('favorite')).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('favorite');
  });
});
