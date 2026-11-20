import { describe, expect, it, vi } from 'vitest';
import type { FavoritesRegistry } from '../../../../ports/outbound/task-service/favorites/favorites-registry.port.js';
import { CreateFavorite } from './create-favorite.use-case.js';

describe('CreateFavorite', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'favorite' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { createFavorite: call } as unknown as FavoritesRegistry;
    await expect(
      new CreateFavorite(registry).execute({ kind: 'list', targetId: 'target' }, 'key'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith({ kind: 'list', targetId: 'target' }, 'key');
  });
});
