import { describe, expect, it, vi } from 'vitest';
import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import { ListDependencyCandidates } from './list-dependency-candidates.use-case.js';

describe('ListDependencyCandidates', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { items: [] };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listDependencyCandidates: call } as unknown as DependenciesRegistry;
    await expect(
      new ListDependencyCandidates(registry).execute('CAD-482', { direction: 'blocks', limit: 20 }),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', { direction: 'blocks', limit: 20 });
  });
});
