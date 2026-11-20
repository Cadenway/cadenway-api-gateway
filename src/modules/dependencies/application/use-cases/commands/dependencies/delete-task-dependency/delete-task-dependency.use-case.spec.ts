import { describe, expect, it, vi } from 'vitest';
import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import { DeleteTaskDependency } from './delete-task-dependency.use-case.js';

describe('DeleteTaskDependency', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = 2;
    const call = vi.fn().mockResolvedValue(result);
    const registry = { deleteTaskDependency: call } as unknown as DependenciesRegistry;
    await expect(
      new DeleteTaskDependency(registry).execute('CAD-482', 'edge', '"1"'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'edge', '"1"');
  });
});
