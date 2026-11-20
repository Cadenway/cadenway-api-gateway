import { describe, expect, it, vi } from 'vitest';
import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import { ListTaskDependencies } from './list-task-dependencies.use-case.js';

describe('ListTaskDependencies', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { items: [] };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listTaskDependencies: call } as unknown as DependenciesRegistry;
    await expect(
      new ListTaskDependencies(registry).execute('CAD-482', { limit: 20 }),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', { limit: 20 });
  });
});
