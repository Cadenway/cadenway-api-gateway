import { describe, expect, it, vi } from 'vitest';
import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import { ListTaskParticipants } from './list-task-participants.use-case.js';

describe('ListTaskParticipants', () => {
  it('forwards its arguments and answer to task-service', async () => {
    const call = vi.fn().mockResolvedValue({ items: [] });
    const registry = { listTaskParticipants: call } as unknown as CommentsRegistry;
    await new ListTaskParticipants(registry).execute('CAD-482', { limit: 20 });
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', { limit: 20 });
  });
});
