import { describe, expect, it, vi } from 'vitest';
import type { TaskTemplatesRegistry } from '../../../../ports/outbound/task-service/templates/task-templates-registry.port.js';
import { ListTaskTemplates } from './list-task-templates.use-case.js';

describe('ListTaskTemplates', () => {
  it('forwards arguments and returns the service result', async () => {
    const result = { items: [] };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { listTaskTemplates: call } as unknown as TaskTemplatesRegistry;
    await expect(new ListTaskTemplates(registry).execute('space', { limit: 20 })).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('space', { limit: 20 });
  });
});
