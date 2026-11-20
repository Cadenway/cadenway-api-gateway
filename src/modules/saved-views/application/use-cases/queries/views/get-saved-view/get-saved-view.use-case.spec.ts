import { describe, expect, it, vi } from 'vitest';
import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import { GetSavedView } from './get-saved-view.use-case.js';

describe('GetSavedView', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'view' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { getSavedView: call } as unknown as SavedViewsRegistry;
    await expect(new GetSavedView(registry).execute('list', 'view')).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('list', 'view');
  });
});
