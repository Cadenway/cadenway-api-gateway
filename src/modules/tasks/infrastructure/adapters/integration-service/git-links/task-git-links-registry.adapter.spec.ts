import { describe, expect, it, vi } from 'vitest';

import type { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import { createTaskGitLinksRegistry } from './task-git-links-registry.adapter.js';

describe('task Git links registry adapter', () => {
  it('authorizes through the task read of task-service and discards the task', async () => {
    const getTask = vi.fn().mockResolvedValue({ key: 'CAD-482' });
    const registry = createTaskGitLinksRegistry(
      { getTask } as unknown as TaskServiceClient,
      {} as IntegrationServiceClient,
    );

    await expect(registry.authorize('CAD-482')).resolves.toBeUndefined();
    expect(getTask).toHaveBeenCalledWith('CAD-482');
  });

  it('reads the page of links from integration-service with the public query', async () => {
    const page = { items: [], nextCursor: null };
    const listTaskGitLinks = vi.fn().mockResolvedValue(page);
    const registry = createTaskGitLinksRegistry(
      {} as TaskServiceClient,
      {
        listTaskGitLinks,
      } as unknown as IntegrationServiceClient,
    );

    await expect(registry.list('CAD-482', { cursor: 'abc', limit: 10 })).resolves.toBe(page);
    expect(listTaskGitLinks).toHaveBeenCalledWith('CAD-482', { cursor: 'abc', limit: 10 });
  });
});
