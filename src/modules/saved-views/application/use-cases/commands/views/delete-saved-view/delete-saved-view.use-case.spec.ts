import { describe, expect, it, vi } from 'vitest';
import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import { DeleteSavedView } from './delete-saved-view.use-case.js';

describe('DeleteSavedView', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = undefined;
    const call = vi.fn().mockResolvedValue(result);
    const registry = { deleteSavedView: call } as unknown as SavedViewsRegistry;
    await expect(new DeleteSavedView(registry).execute('list', 'view', '"1"')).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('list', 'view', '"1"');
  });
});
