import { describe, expect, it, vi } from 'vitest';

import { InvalidReminderCursor } from '../../../../models/reminder/invalid-reminder-cursor.model.js';
import type { ReminderListRecord } from '../../../../models/reminder/reminder-list-record.model.js';
import type { ReminderPageCursor } from '../../../../ports/outbound/crypto/reminder/reminder-page-cursor.port.js';
import type { ReminderListSource } from '../../../../ports/outbound/notification-service/reminder/reminder-list-source.port.js';
import type { ReminderTaskDirectory } from '../../../../ports/outbound/task-service/reminder/reminder-task-directory.port.js';
import { ListReminders } from './list-reminders.use-case.js';

const scope = {
  organizationId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9a00',
  userId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9a01',
};
const overdue = {
  id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9b01',
  taskId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9c01',
  remindAt: '2026-11-07T10:00:00.000Z',
};
const next = {
  id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9b02',
  taskId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9c02',
  remindAt: overdue.remindAt,
};
const hidden = {
  id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9b03',
  taskId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9c03',
  remindAt: '2026-11-21T10:00:00.000Z',
};
const last = {
  id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9b04',
  taskId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9c04',
  remindAt: hidden.remindAt,
};

/** Supplies each port as a programmable boundary fake. */
function setup() {
  const page = vi.fn<ReminderListSource['page']>();
  const selected = vi.fn<ReminderListSource['selected']>();
  const lookup = vi.fn<ReminderTaskDirectory['lookup']>();
  const open = vi.fn<ReminderPageCursor['open']>();
  const seal = vi.fn<ReminderPageCursor['seal']>();
  const useCase = new ListReminders({ page, selected }, { lookup }, { open, seal });
  return { useCase, page, selected, lookup, open, seal };
}

/** Returns the exact private record selected from Notification. */
function record(candidate: typeof overdue): ReminderListRecord {
  return {
    ...candidate,
    note: 'Relancer la revue',
    firedAt: null,
    completedAt: null,
    version: 2,
  };
}

/** Returns only Task's safe display for the given selection. */
function display(taskId: string) {
  return { visible: true, display: { taskId, taskKey: 'CAD-482', taskName: 'Revue' } } as const;
}

describe('ListReminders', () => {
  it('counts all visible records, resumes on a timestamp tie and requests display only for the page', async () => {
    const { useCase, page, selected, lookup, open, seal } = setup();
    page
      .mockResolvedValueOnce({ generation: '18', items: [overdue, next], nextCursor: 'private' })
      .mockResolvedValueOnce({ generation: '18', items: [hidden, last], nextCursor: null });
    lookup
      .mockResolvedValueOnce([{ visible: true }, { visible: true }])
      .mockResolvedValueOnce([{ visible: false }, { visible: true }])
      .mockResolvedValueOnce([display(next.taskId)]);
    open.mockReturnValue(overdue);
    seal.mockReturnValue('next-public');
    selected.mockResolvedValue([record(next)]);

    await expect(useCase.execute({ ...scope, cursor: 'signed', limit: 1 })).resolves.toEqual({
      items: [
        {
          id: next.id,
          taskKey: 'CAD-482',
          taskName: 'Revue',
          remindAt: next.remindAt,
          note: 'Relancer la revue',
          firedAt: null,
          completedAt: null,
          version: 2,
        },
      ],
      nextCursor: 'next-public',
      pendingCount: 3,
    });
    expect(open).toHaveBeenCalledExactlyOnceWith('signed', scope);
    expect(seal).toHaveBeenCalledExactlyOnceWith({ id: next.id, remindAt: next.remindAt }, scope);
    expect(page.mock.calls.map(([query]) => query)).toEqual([
      { limit: 100 },
      { limit: 100, cursor: 'private' },
    ]);
    expect(lookup.mock.calls.map(([ids, withDisplay]) => [ids, withDisplay])).toEqual([
      [[overdue.taskId, next.taskId], false],
      [[hidden.taskId, last.taskId], false],
      [[next.taskId], true],
    ]);
    expect(selected).toHaveBeenCalledExactlyOnceWith(
      '18',
      [{ id: next.id, taskId: next.taskId }],
      expect.any(AbortSignal),
    );
  });

  it('restarts from the first candidate on a generation change without moving the public position', async () => {
    const { useCase, page, selected, lookup, open } = setup();
    page
      .mockResolvedValueOnce({ generation: '18', items: [overdue], nextCursor: 'old' })
      .mockResolvedValueOnce({ generation: '19', items: [next], nextCursor: null })
      .mockResolvedValueOnce({ generation: '20', items: [overdue], nextCursor: 'new' })
      .mockResolvedValueOnce({ generation: '20', items: [next], nextCursor: null });
    lookup.mockImplementation((ids, enrich) =>
      Promise.resolve(ids.map((id) => (enrich ? display(id) : { visible: true }))),
    );
    open.mockReturnValue(overdue);
    selected.mockResolvedValue([record(next)]);

    await expect(useCase.execute({ ...scope, cursor: 'signed' })).resolves.toMatchObject({
      items: [{ id: next.id }],
      nextCursor: null,
      pendingCount: 2,
    });
    expect(page.mock.calls.map(([query]) => query.cursor)).toEqual([
      undefined,
      'old',
      undefined,
      'new',
    ]);
    expect(selected.mock.calls.map(([generation]) => generation)).toEqual(['20']);
  });

  it('retries a missing selected record and verifies the new empty generation', async () => {
    const { useCase, page, selected, lookup } = setup();
    page
      .mockResolvedValueOnce({ generation: '18', items: [overdue], nextCursor: null })
      .mockResolvedValueOnce({ generation: '19', items: [], nextCursor: null });
    selected.mockResolvedValue([]);
    lookup
      .mockResolvedValueOnce([{ visible: true }])
      .mockResolvedValueOnce([display(overdue.taskId)]);

    await expect(useCase.execute(scope)).resolves.toEqual({
      items: [],
      nextCursor: null,
      pendingCount: 0,
    });
    expect(selected.mock.calls.map(([generation, pairs]) => [generation, pairs])).toEqual([
      ['18', [{ id: overdue.id, taskId: overdue.taskId }]],
      ['19', []],
    ]);
  });

  it('does not fetch a note when the display check reports a newly hidden task', async () => {
    const { useCase, page, selected, lookup } = setup();
    page.mockResolvedValue({ generation: '18', items: [overdue], nextCursor: null });
    lookup
      .mockResolvedValueOnce([{ visible: true }])
      .mockResolvedValueOnce([{ visible: false }])
      .mockResolvedValueOnce([{ visible: false }]);
    selected.mockResolvedValue([]);

    await expect(useCase.execute(scope)).resolves.toEqual({
      items: [],
      nextCursor: null,
      pendingCount: 0,
    });
    expect(selected.mock.calls.map(([, pairs]) => pairs)).toEqual([[]]);
  });

  it('returns unavailable when generation verification conflicts repeatedly', async () => {
    const { useCase, page, selected } = setup();
    page.mockResolvedValue({ generation: '18', items: [], nextCursor: null });
    selected.mockResolvedValue(null);

    await expect(useCase.execute(scope)).rejects.toMatchObject({
      code: 'upstream.unavailable',
      service: 'notification-service',
    });
    expect(page).toHaveBeenCalledTimes(3);
  });

  it('fails without returning a partial page if Task answers too few positions', async () => {
    const { useCase, page, selected, lookup } = setup();
    page.mockResolvedValue({ generation: '18', items: [overdue], nextCursor: null });
    lookup.mockResolvedValue([]);

    await expect(useCase.execute(scope)).rejects.toMatchObject({
      code: 'upstream.failed',
      service: 'task-service',
    });
    expect(selected).not.toHaveBeenCalled();
  });

  it('times out a stalled Task lookup under the request budget', async () => {
    const { useCase, page, selected, lookup } = setup();
    page.mockResolvedValue({ generation: '18', items: [overdue], nextCursor: null });
    lookup.mockImplementation(() => new Promise(() => undefined));

    await expect(useCase.execute(scope, 40)).rejects.toMatchObject({
      code: 'upstream.deadline-exceeded',
      service: 'task-service',
    });
    expect(lookup.mock.calls[0]?.[2].aborted).toBe(true);
    expect(selected).not.toHaveBeenCalled();
  });

  it('rejects an already buffered response that settles after the monotonic deadline', async () => {
    const { useCase, page, selected } = setup();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    page.mockImplementation(() => {
      clock.mockReturnValue(51);
      return Promise.resolve({ generation: '18', items: [], nextCursor: null });
    });
    try {
      await expect(useCase.execute(scope, 50)).rejects.toMatchObject({
        code: 'upstream.deadline-exceeded',
        service: 'notification-service',
      });
      expect(selected).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it('rejects a cursor outside the owner scope before calling either service', async () => {
    const { useCase, page, lookup, open } = setup();
    open.mockReturnValue(null);

    await expect(useCase.execute({ ...scope, cursor: 'foreign' })).rejects.toBeInstanceOf(
      InvalidReminderCursor,
    );
    expect(page).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});
