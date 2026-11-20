import { describe, expect, it, vi } from 'vitest';

import type { InboxNotificationSource } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { InboxSubjectVisibility } from '../../../../ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';
import { ScanInboxUnread } from '../scan-inbox-unread/scan-inbox-unread.use-case.js';
import { GetInboxUnreadCount } from './get-inbox-unread-count.use-case.js';

describe('GetInboxUnreadCount', () => {
  it('sums permitted weights across a complete owner generation', async () => {
    const source = {
      listUnreadSubjects: vi
        .fn<InboxNotificationSource['listUnreadSubjects']>()
        .mockResolvedValueOnce({
          generation: '19',
          items: [{ subject: { kind: 'task-id', taskId: 'hidden' }, count: 6 }],
          nextCursor: 'second',
        })
        .mockResolvedValueOnce({
          generation: '19',
          items: [
            { subject: null, count: 4 },
            { subject: { kind: 'list', listId: 'visible' }, count: 2 },
          ],
          nextCursor: null,
        }),
    };
    const visibility = {
      resolve: vi
        .fn<InboxSubjectVisibility['resolve']>()
        .mockResolvedValueOnce([{ visible: false }])
        .mockResolvedValueOnce([{ visible: true }]),
    };
    const count = new GetInboxUnreadCount(new ScanInboxUnread(source, visibility));
    await expect(count.execute()).resolves.toEqual({ unreadCount: 6 });
    expect(source.listUnreadSubjects).toHaveBeenNthCalledWith(
      2,
      'second',
      100,
      expect.any(AbortSignal),
    );
  });

  it('fails when a candidate or cursor is repeated instead of delivering a partial count', async () => {
    const source = {
      listUnreadSubjects: vi.fn<InboxNotificationSource['listUnreadSubjects']>().mockResolvedValue({
        generation: '5',
        items: [{ subject: null, count: 16 }],
        nextCursor: 'repeat',
      }),
    };
    const visibility = { resolve: vi.fn<InboxSubjectVisibility['resolve']>() };
    const count = new GetInboxUnreadCount(new ScanInboxUnread(source, visibility));
    await expect(count.execute()).rejects.toMatchObject({
      service: 'notification-service',
      code: 'upstream.failed',
    });
    expect(visibility.resolve).not.toHaveBeenCalled();
  });

  it('fails with the original deadline instead of returning a partial count', async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise<never>(() => undefined);
      const source = {
        listUnreadSubjects: vi
          .fn<InboxNotificationSource['listUnreadSubjects']>()
          .mockReturnValue(pending),
      };
      const visibility = { resolve: vi.fn<InboxSubjectVisibility['resolve']>() };
      const count = new GetInboxUnreadCount(new ScanInboxUnread(source, visibility));
      const check = expect(count.execute(30)).rejects.toMatchObject({
        code: 'upstream.deadline-exceeded',
      });
      await vi.advanceTimersByTimeAsync(30);
      await check;
      expect(source.listUnreadSubjects.mock.calls[0]?.[2].aborted).toBe(true);
      expect(visibility.resolve).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
