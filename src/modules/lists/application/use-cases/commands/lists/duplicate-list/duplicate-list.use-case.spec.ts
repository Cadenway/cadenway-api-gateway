import { describe, expect, it, vi } from 'vitest';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';
import { DuplicateList } from './duplicate-list.use-case.js';

describe('DuplicateList', () => {
  it('forwards arguments and the service result', async () => {
    const result = { value: 1 };
    const call = vi.fn().mockResolvedValue(result);
    const registry = { duplicateList: call } as unknown as ListRegistry;
    await expect(new DuplicateList(registry).execute('list', {}, '"2"', 'key')).resolves.toEqual(
      result,
    );
    expect(call).toHaveBeenCalledExactlyOnceWith('list', {}, '"2"', 'key');
  });
});
