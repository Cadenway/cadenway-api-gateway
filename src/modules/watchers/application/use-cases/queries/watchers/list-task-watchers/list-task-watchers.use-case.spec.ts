import { describe, expect, it, vi } from 'vitest';
import type { WatchersRegistry } from '../../../../ports/outbound/task-service/watchers/watchers-registry.port.js';
import { ListTaskWatchers } from './list-task-watchers.use-case.js';

describe('ListTaskWatchers', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { items: [] };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listTaskWatchers: call } as unknown as WatchersRegistry;
    await expect(new ListTaskWatchers(registry).execute('CAD-482', { limit: 20 })).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', { limit: 20 });
  });
});
