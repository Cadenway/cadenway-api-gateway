import { describe, expect, it, vi } from 'vitest';

import type { AutomationRunCandidate } from '../../../../models/automations/automation-run-candidate.model.js';
import type { AutomationRunCandidatePage } from '../../../../models/automations/automation-run-candidate-page.model.js';
import type { AutomationRegistry } from '../../../../ports/outbound/automation-service/rules/automation-registry.port.js';
import { ReadAutomations } from './read-automations.use-case.js';

function run(
  position: number,
  taskKey: string = `CAD-${String(position)}`,
): AutomationRunCandidate {
  return {
    executionId: `019a701b-2b3c-7d4e-8f5a-${String(position).padStart(12, '0')}`,
    ruleId: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01',
    taskKey,
    action: { type: 'comment' },
    executedAt: new Date(Date.UTC(2026, 10, 20, 8, -position)).toISOString(),
  };
}

function fixture(pages: readonly AutomationRunCandidatePage[]) {
  const authorize = vi.fn<AutomationRegistry['authorize']>().mockResolvedValue(undefined);
  const canReadTask = vi
    .fn<(key: string, signal?: AbortSignal) => Promise<boolean>>()
    .mockResolvedValue(true);
  const visibleTaskKeys = vi
    .fn<AutomationRegistry['visibleTaskKeys']>()
    .mockImplementation(async (keys, signal) => {
      const checked = await Promise.all(
        keys.map(async (key) => ((await canReadTask(key, signal)) ? key : null)),
      );
      return new Set(checked.filter((key) => key !== null));
    });
  const listRunCandidates = vi.fn<AutomationRegistry['listRunCandidates']>();
  for (const page of pages) listRunCandidates.mockResolvedValueOnce(page);
  const read = new ReadAutomations({
    authorize,
    visibleTaskKeys,
    listRunCandidates,
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });
  return { read, authorize, canReadTask, visibleTaskKeys, listRunCandidates };
}

describe('ReadAutomations execution history', () => {
  it('authorizes before reading and preserves source order while stopping at eight visible runs', async () => {
    const first = [run(1), run(2), run(3, 'CAD-2'), run(4)];
    const second = Array.from({ length: 12 }, (_, i) => run(i + 5));
    const { read, authorize, canReadTask, visibleTaskKeys, listRunCandidates } = fixture([
      { items: first, nextCursor: 'continuation' },
      { items: second, nextCursor: 'unused' },
    ]);
    canReadTask.mockImplementation((key) => Promise.resolve(key !== 'CAD-1'));
    await expect(read.execute({ kind: 'runs' })).resolves.toEqual({
      items: [...first.slice(1), ...second.slice(0, 5)],
    });
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(
      listRunCandidates.mock.invocationCallOrder[0] ?? 0,
    );
    expect(listRunCandidates.mock.calls.map(([query]) => query)).toEqual([
      { limit: 32 },
      { cursor: 'continuation', limit: 32 },
    ]);
    expect(visibleTaskKeys.mock.calls.map(([keys]) => keys)).toEqual([
      ['CAD-1', 'CAD-2', 'CAD-4'],
      second.map(({ taskKey }) => taskKey),
    ]);
  });

  it('checks at most the 100 newest candidates overall and omits cursors and hidden counts', async () => {
    const pages = [32, 32, 32, 4].map((size, page) => ({
      items: Array.from({ length: size }, (_, i) => run(page * 32 + i + 1)),
      nextCursor: `page-${String(page + 2)}`,
    }));
    const { read, canReadTask, listRunCandidates, visibleTaskKeys } = fixture(pages);
    canReadTask.mockResolvedValue(false);

    await expect(read.execute({ kind: 'runs' })).resolves.toEqual({ items: [] });
    expect(canReadTask).toHaveBeenCalledTimes(100);
    expect(visibleTaskKeys.mock.calls.map(([keys]) => keys.length)).toEqual([32, 32, 32, 4]);
    expect(listRunCandidates.mock.calls.map(([query]) => query.limit)).toEqual([32, 32, 32, 4]);
  });

  it('returns no partial history when a later visibility batch fails', async () => {
    const { read, visibleTaskKeys } = fixture([
      { items: [run(1)], nextCursor: 'second' },
      { items: [run(2)], nextCursor: null },
    ]);
    const unavailable = new Error('upstream failed');
    visibleTaskKeys.mockResolvedValueOnce(new Set(['CAD-1'])).mockRejectedValueOnce(unavailable);
    await expect(read.execute({ kind: 'runs' })).rejects.toBe(unavailable);
    expect(visibleTaskKeys).toHaveBeenCalledTimes(2);
    expect(visibleTaskKeys.mock.calls[1]?.[1]?.aborted).toBe(true);
  });

  it('does not fetch any candidate if the current role cannot read the history', async () => {
    const { read, authorize, listRunCandidates, canReadTask } = fixture([]);
    const refused = new Error('role forbidden');
    authorize.mockRejectedValueOnce(refused);
    await expect(read.execute({ kind: 'runs' })).rejects.toBe(refused);
    expect(listRunCandidates).not.toHaveBeenCalled();
    expect(canReadTask).not.toHaveBeenCalled();
  });
});
