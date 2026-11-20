import { describe, expect, it, vi } from 'vitest';

import { InboxNotFound } from '../../../../models/inbox/inbox-not-found.model.js';
import { InboxUnavailable } from '../../../../models/inbox/inbox-unavailable.model.js';
import { ChangeInboxNotification } from './change-inbox-notification.use-case.js';

describe('ChangeInboxNotification', () => {
  const subject = { kind: 'task-key', taskKey: 'CAD-482' } as const;
  const record = {
    id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e11',
    kind: 'mention',
    subject,
    actorUserId: null,
    createdAt: '2026-11-08T08:48:00Z',
    readAt: null,
    archivedAt: null,
    version: 1,
  };
  const display = { taskId: 'task-id', taskKey: 'CAD-482', taskName: 'Task' };

  it('checks the exact subject before and after the mutation', async () => {
    const source = {
      candidate: vi.fn().mockResolvedValue({ id: record.id, subject }),
      change: vi.fn().mockResolvedValue({ ...record, version: 2 }),
    };
    const visibility = {
      resolve: vi
        .fn()
        .mockResolvedValueOnce([{ visible: true }])
        .mockResolvedValueOnce([{ visible: true, display }]),
    };
    const names = { lookup: vi.fn() };
    const result = await new ChangeInboxNotification(source, visibility, names).execute(
      record.id,
      'read',
      '"1"',
    );
    expect(source.change).toHaveBeenCalledWith(record.id, subject, 'read', '"1"');
    expect(visibility.resolve).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      id: record.id,
      version: 2,
      task: { taskKey: 'CAD-482', name: 'Task' },
    });
  });

  it('conceals a subject which became hidden before checking a version', async () => {
    const source = {
      candidate: vi.fn().mockResolvedValue({ id: record.id, subject }),
      change: vi.fn(),
    };
    const visibility = { resolve: vi.fn().mockResolvedValue([{ visible: false }]) };
    await expect(
      new ChangeInboxNotification(source, visibility, { lookup: vi.fn() }).execute(
        record.id,
        'archive',
        '"4"',
      ),
    ).rejects.toBeInstanceOf(InboxNotFound);
    expect(source.change).not.toHaveBeenCalled();
  });

  it('rejects a changed binding even if the upstream claims success', async () => {
    const source = {
      candidate: vi.fn().mockResolvedValue({ id: record.id, subject }),
      change: vi.fn().mockResolvedValue({ ...record, subject: null }),
    };
    const visibility = { resolve: vi.fn().mockResolvedValue([{ visible: true }]) };
    await expect(
      new ChangeInboxNotification(source, visibility, { lookup: vi.fn() }).execute(
        record.id,
        'read',
        undefined,
      ),
    ).rejects.toBeInstanceOf(InboxUnavailable);
  });
});
