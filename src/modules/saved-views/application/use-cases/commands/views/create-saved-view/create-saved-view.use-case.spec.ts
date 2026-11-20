import { describe, expect, it, vi } from 'vitest';
import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import { CreateSavedView } from './create-saved-view.use-case.js';

describe('CreateSavedView', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'view' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { createSavedView: call } as unknown as SavedViewsRegistry;
    await expect(
      new CreateSavedView(registry).execute('list', { name: 'View' }, 'key'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('list', { name: 'View' }, 'key');
  });
});
