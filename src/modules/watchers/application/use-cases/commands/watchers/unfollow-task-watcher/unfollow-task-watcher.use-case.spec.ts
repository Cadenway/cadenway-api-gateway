import { describe, expect, it, vi } from 'vitest';
import type { WatchersRegistry } from '../../../../ports/outbound/task-service/watchers/watchers-registry.port.js';
import { UnfollowTaskWatcher } from './unfollow-task-watcher.use-case.js';

describe('UnfollowTaskWatcher', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = 2;
    const call = vi.fn().mockResolvedValue(result);
    const registry = { unfollowTaskWatcher: call } as unknown as WatchersRegistry;
    await expect(
      new UnfollowTaskWatcher(registry).execute('CAD-482', 'user', '"1"'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'user', '"1"');
  });
});
