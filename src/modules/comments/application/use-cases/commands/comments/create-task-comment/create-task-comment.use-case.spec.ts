import { describe, expect, it, vi } from 'vitest';
import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import { CreateTaskComment } from './create-task-comment.use-case.js';

describe('CreateTaskComment', () => {
  it('forwards its arguments and answer to task-service', async () => {
    const call = vi.fn().mockResolvedValue({ items: [] });
    const registry = { createTaskComment: call } as unknown as CommentsRegistry;
    await new CreateTaskComment(registry).execute('CAD-482', { body: 'hello' }, 'key');
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', { body: 'hello' }, 'key');
  });
});
