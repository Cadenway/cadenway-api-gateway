import { describe, expect, it, vi } from 'vitest';
import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import { UpdateTaskComment } from './update-task-comment.use-case.js';

describe('UpdateTaskComment', () => {
  it('forwards its arguments and answer to task-service', async () => {
    const call = vi.fn().mockResolvedValue({ items: [] });
    const registry = { updateTaskComment: call } as unknown as CommentsRegistry;
    await new UpdateTaskComment(registry).execute('CAD-482', 'comment', { body: 'changed' }, '"1"');
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'comment', { body: 'changed' }, '"1"');
  });
});
