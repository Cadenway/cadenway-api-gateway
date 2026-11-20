import { describe, expect, it, vi } from 'vitest';
import type { TaskTemplatesRegistry } from '../../../../ports/outbound/task-service/templates/task-templates-registry.port.js';
import { GetTaskTemplate } from './get-task-template.use-case.js';

describe('GetTaskTemplate', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'template' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { getTaskTemplate: call } as unknown as TaskTemplatesRegistry;
    await expect(new GetTaskTemplate(registry).execute('space', 'template')).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('space', 'template');
  });
});
