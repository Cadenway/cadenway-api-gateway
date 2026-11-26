import { ProblemException } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import type { TaskGitLinksRegistry } from '../../../../ports/outbound/integration-service/git-links/task-git-links-registry.port.js';
import { ListTaskGitLinks } from './list-task-git-links.use-case.js';

/**
 * A registry whose task read succeeds and whose link read answers an empty page.
 *
 * @returns The registry and its two reads.
 */
function fixture() {
  const authorize = vi.fn<TaskGitLinksRegistry['authorize']>(() => Promise.resolve());
  const list = vi.fn<TaskGitLinksRegistry['list']>(() =>
    Promise.resolve({ items: [], nextCursor: null }),
  );
  const registry: TaskGitLinksRegistry = { authorize, list };
  return { registry, authorize, list };
}

describe('ListTaskGitLinks', () => {
  it('reads the task before its links and returns the page', async () => {
    const { registry, authorize, list } = fixture();

    await expect(new ListTaskGitLinks(registry).execute('CAD-482', { limit: 20 })).resolves.toEqual(
      { items: [], nextCursor: null },
    );

    expect(authorize).toHaveBeenCalledWith('CAD-482');
    expect(list).toHaveBeenCalledWith('CAD-482', { limit: 20 });
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(
      list.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('never reads the links of a task the caller does not see', async () => {
    const { registry, authorize, list } = fixture();
    const hidden = new ProblemException({ status: 404, code: 'task.not-found' });
    authorize.mockRejectedValue(hidden);

    await expect(new ListTaskGitLinks(registry).execute('CAD-482', {})).rejects.toBe(hidden);
    expect(list).not.toHaveBeenCalled();
  });
});
