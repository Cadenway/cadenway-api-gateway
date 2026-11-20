import { describe, expect, it, vi } from 'vitest';
import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import { CreateTaskDependency } from './create-task-dependency.use-case.js';

describe('CreateTaskDependency', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { dependency: { id: 'edge' }, version: 2 };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { createTaskDependency: call } as unknown as DependenciesRegistry;
    await expect(
      new CreateTaskDependency(registry).execute(
        'CAD-482',
        { otherTaskKey: 'CAD-483', direction: 'blocks' },
        '"1"',
        'key',
      ),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith(
      'CAD-482',
      { otherTaskKey: 'CAD-483', direction: 'blocks' },
      '"1"',
      'key',
    );
  });
});
