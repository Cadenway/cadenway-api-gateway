import { describe, expect, it, vi } from 'vitest';
import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import { UpdateSavedView } from './update-saved-view.use-case.js';

describe('UpdateSavedView', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'view' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { updateSavedView: call } as unknown as SavedViewsRegistry;
    await expect(
      new UpdateSavedView(registry).execute('list', 'view', { name: 'New' }, '"1"'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('list', 'view', { name: 'New' }, '"1"');
  });
});
