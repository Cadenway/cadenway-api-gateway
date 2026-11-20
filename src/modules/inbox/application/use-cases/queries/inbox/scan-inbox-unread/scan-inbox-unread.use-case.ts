import { InboxGenerationChanged } from '../../../../models/inbox/inbox-generation-changed.model.js';
import type { InboxSubject } from '../../../../models/inbox/inbox-subject.model.js';
import { InboxUnavailable } from '../../../../models/inbox/inbox-unavailable.model.js';
import type { InboxNotificationSource } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { InboxSubjectVisibility } from '../../../../ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';
import type { ScanInboxUnreadOutput } from './scan-inbox-unread.output.js';

const BATCH_SIZE = 100;
const GENERATION_ATTEMPTS = 3;

/** Equates UUID spelling without changing the exact selector sent to Notification. */
function groupKey(subject: InboxSubject | null): string {
  switch (subject?.kind) {
    case 'task-id':
      return `task-id:${subject.taskId.toLowerCase()}`;
    case 'task-key':
      return `task-key:${subject.taskKey}`;
    case 'list':
      return `list:${subject.listId.toLowerCase()}`;
    case 'space':
      return `space:${subject.spaceId.toLowerCase()}`;
    default:
      return '';
  }
}

/** Assembles unread weights for one recipient from complete, generation-pinned pages. */
export class ScanInboxUnread {
  // #region Constructor
  /** Binds both services under the same verified organization context. */
  public constructor(
    private readonly source: Pick<InboxNotificationSource, 'listUnreadSubjects'>,
    private readonly visibility: InboxSubjectVisibility,
  ) {}
  // #endregion

  // #region Methods
  /** Repeats only an explicit generation conflict while the original budget permits. */
  public async retry<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
      signal.throwIfAborted();
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof InboxGenerationChanged)) throw error;
      }
    }
    throw new InboxUnavailable('notification-service');
  }

  /** Exposes the first observed generation as soon as it can fix the write cutoff. */
  public async execute(
    signal: AbortSignal,
    onGeneration?: (generation: string) => void,
  ): Promise<ScanInboxUnreadOutput> {
    let cursor: string | null = null;
    let generation: string | undefined;
    let unreadCount = 0;
    const seenCursors = new Set<string>();
    const seenSubjects = new Set<string>();
    const authorizedSubjects: InboxSubject[] = [];
    for (;;) {
      signal.throwIfAborted();
      const page: Awaited<ReturnType<InboxNotificationSource['listUnreadSubjects']>> =
        await this.source.listUnreadSubjects(cursor, BATCH_SIZE, signal);
      signal.throwIfAborted();
      if (generation === undefined) {
        generation = page.generation;
        onGeneration?.(generation);
      } else if (generation !== page.generation) {
        throw new InboxGenerationChanged();
      }

      if (page.items.length > BATCH_SIZE || (page.nextCursor !== null && page.items.length === 0)) {
        throw new InboxUnavailable('notification-service');
      }
      const linked = page.items.flatMap(({ subject }) => (subject === null ? [] : [{ subject }]));
      const decisions = linked.length === 0 ? [] : await this.visibility.resolve(linked, signal);
      signal.throwIfAborted();
      if (decisions.length !== linked.length) throw new InboxUnavailable('task-service');

      let index = 0;
      for (const { subject, count } of page.items) {
        const key = groupKey(subject);
        if (seenSubjects.has(key) || !Number.isSafeInteger(count) || count < 1) {
          throw new InboxUnavailable('notification-service');
        }
        seenSubjects.add(key);
        if (subject !== null) {
          if (!decisions[index++]?.visible) continue;
          authorizedSubjects.push(subject);
        }
        unreadCount += count;
        if (!Number.isSafeInteger(unreadCount)) throw new InboxUnavailable('notification-service');
      }

      cursor = page.nextCursor;
      if (cursor === null) return { generation, unreadCount, authorizedSubjects };
      if (seenCursors.has(cursor)) throw new InboxUnavailable('notification-service');
      seenCursors.add(cursor);
    }
  }
  // #endregion
}
