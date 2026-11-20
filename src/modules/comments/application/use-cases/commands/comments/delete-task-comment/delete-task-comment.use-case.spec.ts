import { describe, expect, it, vi } from 'vitest';
import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import { DeleteTaskComment } from './delete-task-comment.use-case.js';

describe('DeleteTaskComment', () => {
  it('forwards its arguments and answer to task-service', async () => {
    const call = vi.fn().mockResolvedValue(undefined);
    const registry = { deleteTaskComment: call } as unknown as CommentsRegistry;
    await new DeleteTaskComment(registry).execute('CAD-482', 'comment', '"1"');
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'comment', '"1"');
  });
});
