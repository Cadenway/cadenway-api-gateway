import { describe, expect, it, vi } from 'vitest';
import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import { GetTaskComment } from './get-task-comment.use-case.js';

describe('GetTaskComment', () => {
  it('forwards its arguments and answer to task-service', async () => {
    const call = vi.fn().mockResolvedValue({ items: [] });
    const registry = { getTaskComment: call } as unknown as CommentsRegistry;
    await new GetTaskComment(registry).execute('CAD-482', 'comment');
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'comment');
  });
});
