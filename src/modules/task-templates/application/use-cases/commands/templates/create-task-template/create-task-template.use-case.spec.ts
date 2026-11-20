import { describe, expect, it, vi } from 'vitest';
import type { TaskTemplatesRegistry } from '../../../../ports/outbound/task-service/templates/task-templates-registry.port.js';
import { CreateTaskTemplate } from './create-task-template.use-case.js';

describe('CreateTaskTemplate', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { id: 'template' };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { createTaskTemplate: call } as unknown as TaskTemplatesRegistry;
    await expect(
      new CreateTaskTemplate(registry).execute(
        'space',
        { sourceTaskKey: 'CAD-482', name: 'Template' },
        'key',
      ),
    ).resolves.toEqual(result);
    expect(call).toHaveBeenCalledExactlyOnceWith(
      'space',
      { sourceTaskKey: 'CAD-482', name: 'Template' },
      'key',
    );
  });
});
