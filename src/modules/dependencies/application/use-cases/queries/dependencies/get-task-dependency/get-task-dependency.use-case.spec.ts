import { describe, expect, it, vi } from 'vitest';
import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import { GetTaskDependency } from './get-task-dependency.use-case.js';

describe('GetTaskDependency', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'edge' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { getTaskDependency: call } as unknown as DependenciesRegistry;
    await expect(new GetTaskDependency(registry).execute('CAD-482', 'edge')).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', 'edge');
  });
});
