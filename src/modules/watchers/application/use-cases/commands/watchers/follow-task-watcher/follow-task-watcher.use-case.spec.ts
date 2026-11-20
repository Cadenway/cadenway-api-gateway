import { describe, expect, it, vi } from 'vitest';
import type { WatchersRegistry } from '../../../../ports/outbound/task-service/watchers/watchers-registry.port.js';
import { FollowTaskWatcher } from './follow-task-watcher.use-case.js';

describe('FollowTaskWatcher', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { watcher: { userId: 'user' }, version: 2 };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { followTaskWatcher: call } as unknown as WatchersRegistry;
    await expect(
      new FollowTaskWatcher(registry).execute('CAD-482', 'user', {}, '"1"'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'user', {}, '"1"');
  });
});
