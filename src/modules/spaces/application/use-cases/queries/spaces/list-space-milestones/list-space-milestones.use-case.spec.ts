import { describe, expect, it, vi } from 'vitest';
import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';
import { ListSpaceMilestones } from './list-space-milestones.use-case.js';

describe('ListSpaceMilestones', () => {
  it('forwards arguments and the service result', async () => {
    const result = { value: 1 };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listSpaceMilestones: call } as unknown as SpaceRegistry;
    await expect(
      new ListSpaceMilestones(registry).execute('space', { limit: 20 }),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('space', { limit: 20 });
  });
});
