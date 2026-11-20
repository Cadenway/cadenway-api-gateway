import { describe, expect, it, vi } from 'vitest';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';
import { ExecuteBulkTaskAction } from './execute-bulk-task-action.use-case.js';

describe('ExecuteBulkTaskAction', () => {
  it('forwards the action and key and returns the service result', async () => {
    const result = { results: [], affectedCount: 0 };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { executeBulkTaskAction: call } as unknown as TaskRegistry;
    const body = {
      selection: [{ taskKey: 'CAD-482' }],
      action: { type: 'status', status: 'done' },
    };
    await expect(new ExecuteBulkTaskAction(registry).execute(body, 'bulk-key')).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith(body, 'bulk-key');
  });
});
