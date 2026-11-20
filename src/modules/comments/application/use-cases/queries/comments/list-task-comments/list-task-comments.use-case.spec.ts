import { describe, expect, it, vi } from 'vitest';
import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import { ListTaskComments } from './list-task-comments.use-case.js';

describe('ListTaskComments', () => {
  it('forwards its arguments and answer to task-service', async () => {
    const call = vi.fn().mockResolvedValue({ items: [] });
    const registry = { listTaskComments: call } as unknown as CommentsRegistry;
    await new ListTaskComments(registry).execute('CAD-482', { limit: 20 });
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', { limit: 20 });
  });
});
