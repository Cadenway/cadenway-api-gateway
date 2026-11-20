import { describe, expect, it, vi } from 'vitest';

import type { InboxCandidate } from '../../../../models/inbox/inbox-candidate.model.js';
import type { InboxActorNames } from '../../../../ports/outbound/organization-service/inbox/inbox-actor-names.port.js';
import type { InboxNotificationSource } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { InboxSubjectVisibility } from '../../../../ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';
import { ScanInboxUnread } from '../scan-inbox-unread/scan-inbox-unread.use-case.js';
import { ListInboxNotifications } from './list-inbox-notifications.use-case.js';

const firstTask = { kind: 'task-key', taskKey: 'CAD-482' } as const;
const hiddenList = { kind: 'list', listId: 'hidden-list' } as const;

function candidate(id: string, input: Partial<InboxCandidate> = {}): InboxCandidate {
  return {
    id,
    kind: 'mention',
    subject: firstTask,
    actorUserId: 'visible-actor',
    createdAt: '2026-11-20T10:40:00Z',
    readAt: null,
    archivedAt: null,
    version: 1,
    ...input,
  };
}

describe('ListInboxNotifications', () => {
  it('resumes before a visible lookahead across hidden candidates and sends only returned linked actors to Organization', async () => {
    const source = {
      listCandidates: vi
        .fn<InboxNotificationSource['listCandidates']>()
        .mockResolvedValueOnce({
          items: [
            {
              record: candidate('first', { commentId: 'live-comment', status: 'todo' }),
              cursorAfter: 'after-first',
            },
            {
              record: candidate('hidden', { subject: hiddenList, actorUserId: 'hidden-actor' }),
              cursorAfter: 'after-hidden',
            },
          ],
          nextCursor: 'after-hidden',
        })
        .mockResolvedValue({
          items: [
            {
              record: candidate('owner-only', { subject: null, actorUserId: 'unlinked-actor' }),
              cursorAfter: 'after-owner',
            },
          ],
          nextCursor: null,
        }),
      listUnreadSubjects: vi.fn<InboxNotificationSource['listUnreadSubjects']>().mockResolvedValue({
        generation: '12',
        items: [
          { subject: null, count: 8 },
          { subject: hiddenList, count: 4 },
        ],
        nextCursor: null,
      }),
    };
    const visibility = {
      resolve: vi.fn<InboxSubjectVisibility['resolve']>((inputs) =>
        Promise.resolve(
          inputs.map((input) =>
            input.subject.kind === 'task-key'
              ? {
                  visible: true,
                  display: {
                    taskId: 'task',
                    taskKey: 'CAD-482',
                    taskName: 'Current task',
                    commentExcerpt: 'Current comment',
                  },
                }
              : { visible: false },
          ),
        ),
      ),
    };
    const names = {
      lookup: vi.fn<InboxActorNames['lookup']>().mockResolvedValue({
        items: [{ userId: 'visible-actor', name: 'Visible actor' }],
      }),
    };
    const list = new ListInboxNotifications(
      source,
      visibility,
      names,
      new ScanInboxUnread(source, visibility),
    );

    await expect(list.execute({ state: 'active', cursor: null, limit: 1 })).resolves.toEqual({
      items: [
        {
          id: 'first',
          kind: 'mention',
          actor: { userId: 'visible-actor', name: 'Visible actor' },
          task: { taskKey: 'CAD-482', name: 'Current task' },
          excerpt: 'Current comment',
          status: 'todo',
          createdAt: '2026-11-20T10:40:00Z',
          readAt: null,
          archivedAt: null,
          version: 1,
        },
      ],
      nextCursor: 'after-hidden',
      unreadCount: 8,
    });
    await expect(
      list.execute({ state: 'active', cursor: 'after-hidden', limit: 1 }),
    ).resolves.toMatchObject({
      items: [{ id: 'owner-only', actor: null, task: null, excerpt: null, status: null }],
      nextCursor: null,
      unreadCount: 8,
    });
    expect(names.lookup).toHaveBeenCalledExactlyOnceWith(
      ['visible-actor'],
      expect.any(AbortSignal),
    );
    expect(visibility.resolve).toHaveBeenCalledWith(
      [{ subject: firstTask, display: { commentId: 'live-comment' } }, { subject: hiddenList }],
      expect.any(AbortSignal),
    );
  });

  it('fails the whole page if Task omits requested display for a visible item', async () => {
    const source = {
      listCandidates: vi.fn<InboxNotificationSource['listCandidates']>().mockResolvedValue({
        items: [{ record: candidate('first'), cursorAfter: 'after-first' }],
        nextCursor: null,
      }),
      listUnreadSubjects: vi.fn<InboxNotificationSource['listUnreadSubjects']>().mockResolvedValue({
        generation: '12',
        items: [],
        nextCursor: null,
      }),
    };
    const visibility = {
      resolve: vi.fn<InboxSubjectVisibility['resolve']>().mockResolvedValue([{ visible: true }]),
    };
    const names = { lookup: vi.fn<InboxActorNames['lookup']>() };
    const list = new ListInboxNotifications(
      source,
      visibility,
      names,
      new ScanInboxUnread(source, visibility),
    );
    await expect(
      list.execute({ state: 'archived', cursor: null, limit: 20 }),
    ).rejects.toMatchObject({
      service: 'task-service',
      code: 'upstream.failed',
    });
    expect(names.lookup).not.toHaveBeenCalled();
  });
});
