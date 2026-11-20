import { describe, expect, it, vi } from 'vitest';

import { InboxGenerationChanged } from '../../../../models/inbox/inbox-generation-changed.model.js';
import type { InboxNotificationSource } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { InboxSubjectVisibility } from '../../../../ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';
import { ScanInboxUnread } from '../../../queries/inbox/scan-inbox-unread/scan-inbox-unread.use-case.js';
import { MarkInboxNotificationsRead } from './mark-inbox-notifications-read.use-case.js';

const taskKey = { kind: 'task-key', taskKey: 'CAD-482' } as const;
const taskId = { kind: 'task-id', taskId: 'task-uuid' } as const;
const denied = { kind: 'space', spaceId: 'hidden-space' } as const;

describe('MarkInboxNotificationsRead', () => {
  it('retains the first cutoff through a continuation conflict and a write conflict', async () => {
    const source = {
      listUnreadSubjects: vi
        .fn<InboxNotificationSource['listUnreadSubjects']>()
        .mockResolvedValueOnce({
          generation: '12',
          items: [{ subject: taskKey, count: 2 }],
          nextCursor: 'old',
        })
        .mockRejectedValueOnce(new InboxGenerationChanged())
        .mockResolvedValueOnce({
          generation: '13',
          items: [{ subject: denied, count: 3 }],
          nextCursor: null,
        })
        .mockResolvedValueOnce({
          generation: '14',
          items: [
            { subject: taskKey, count: 2 },
            { subject: taskId, count: 5 },
            { subject: denied, count: 4 },
            { subject: null, count: 1 },
          ],
          nextCursor: null,
        }),
      markReadAll: vi
        .fn<InboxNotificationSource['markReadAll']>()
        .mockRejectedValueOnce(new InboxGenerationChanged())
        .mockResolvedValueOnce({ markedRead: 4, unreadCount: 2 }),
    };
    const visibility = {
      resolve: vi.fn<InboxSubjectVisibility['resolve']>((inputs) =>
        Promise.resolve(inputs.map(({ subject }) => ({ visible: subject.kind !== 'space' }))),
      ),
    };
    const mark = new MarkInboxNotificationsRead(source, new ScanInboxUnread(source, visibility));
    await expect(mark.execute()).resolves.toEqual({ markedRead: 4, unreadCount: 2 });
    expect(source.markReadAll).toHaveBeenNthCalledWith(
      1,
      {
        snapshotGeneration: '13',
        creationCutoff: '12',
        authorizedSubjects: [],
      },
      expect.any(AbortSignal),
    );
    expect(source.markReadAll).toHaveBeenNthCalledWith(
      2,
      {
        snapshotGeneration: '14',
        creationCutoff: '12',
        authorizedSubjects: [taskKey, taskId],
      },
      expect.any(AbortSignal),
    );
  });

  it('stops after three conflicting scans and commits nothing', async () => {
    const source = {
      listUnreadSubjects: vi
        .fn<InboxNotificationSource['listUnreadSubjects']>()
        .mockRejectedValue(new InboxGenerationChanged()),
      markReadAll: vi.fn<InboxNotificationSource['markReadAll']>(),
    };
    const visibility = { resolve: vi.fn<InboxSubjectVisibility['resolve']>() };
    const mark = new MarkInboxNotificationsRead(source, new ScanInboxUnread(source, visibility));
    await expect(mark.execute()).rejects.toMatchObject({
      service: 'notification-service',
      code: 'upstream.failed',
    });
    expect(source.listUnreadSubjects).toHaveBeenCalledTimes(3);
    expect(source.markReadAll).not.toHaveBeenCalled();
  });
});
