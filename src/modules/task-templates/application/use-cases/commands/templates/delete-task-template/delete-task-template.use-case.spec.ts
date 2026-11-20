import { describe, expect, it, vi } from 'vitest';
import type { TaskTemplatesRegistry } from '../../../../ports/outbound/task-service/templates/task-templates-registry.port.js';
import { DeleteTaskTemplate } from './delete-task-template.use-case.js';

describe('DeleteTaskTemplate', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = undefined;
    const call = vi.fn().mockResolvedValue(result);
    const registry = { deleteTaskTemplate: call } as unknown as TaskTemplatesRegistry;
    await expect(
      new DeleteTaskTemplate(registry).execute('space', 'template', '"1"'),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith('space', 'template', '"1"');
  });
});
