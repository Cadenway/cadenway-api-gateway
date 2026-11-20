import { describe, expect, it, vi } from 'vitest';
import type { SavedViewsRegistry } from '../../../../ports/outbound/task-service/views/saved-views-registry.port.js';
import { DuplicateSavedView } from './duplicate-saved-view.use-case.js';

describe('DuplicateSavedView', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'copy' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { duplicateSavedView: call } as unknown as SavedViewsRegistry;
    await expect(
      new DuplicateSavedView(registry).execute('list', 'view', {}, '"1"', 'key'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('list', 'view', {}, '"1"', 'key');
  });
});
