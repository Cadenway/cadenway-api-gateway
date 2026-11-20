import { describe, expect, it, vi } from 'vitest';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';
import { DuplicateTask } from './duplicate-task.use-case.js';

describe('DuplicateTask', () => {
  it('forwards arguments and the service result', async () => {
    const result = { value: 1 };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { duplicateTask: call } as unknown as TaskRegistry;
    await expect(new DuplicateTask(registry).execute('CAD-482', {}, '"2"', 'key')).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('CAD-482', {}, '"2"', 'key');
  });
});
