import { describe, expect, it, vi } from 'vitest';
import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import { ListSavedViews } from './list-saved-views.use-case.js';

describe('ListSavedViews', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { items: [] };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listSavedViews: call } as unknown as SavedViewsRegistry;
    await expect(new ListSavedViews(registry).execute('list', { limit: 20 })).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('list', { limit: 20 });
  });
});
