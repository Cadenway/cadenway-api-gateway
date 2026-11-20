import type { InboxCandidate } from '../../../../models/inbox/inbox-candidate.model.js';
import type { InboxCursorScope } from '../../../../models/inbox/inbox-cursor-scope.model.js';
import type { InboxListQuery } from '../../../../models/inbox/inbox-list-query.model.js';
import type { InboxNotification } from '../../../../models/inbox/inbox-notification.model.js';
import type { InboxPage } from '../../../../models/inbox/inbox-page.model.js';
import { InboxUnavailable } from '../../../../models/inbox/inbox-unavailable.model.js';
import type { InboxVisibilityDecision } from '../../../../models/inbox/inbox-visibility-decision.model.js';
import type { InboxVisibilityInput } from '../../../../models/inbox/inbox-visibility-input.model.js';
import { withInboxBudget } from '../../../../models/inbox/inbox-work-budget.model.js';
import { InvalidInboxCursor } from '../../../../models/inbox/invalid-inbox-cursor.model.js';
import type { InboxPageCursor } from '../../../../ports/outbound/crypto/inbox/inbox-page-cursor.port.js';
import type { InboxNotificationSource } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { InboxActorNames } from '../../../../ports/outbound/organization-service/inbox/inbox-actor-names.port.js';
import type { InboxSubjectVisibility } from '../../../../ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';
import type { ScanInboxUnread } from '../scan-inbox-unread/scan-inbox-unread.use-case.js';

const BATCH_SIZE = 100;

/** One candidate permitted by Task, or an owner-only generic record. */
interface VisibleCandidate {
  // #region Properties
  /** The original notification record. */
  readonly record: InboxCandidate;

  /** Approved Task display for task-linked candidates only. */
  readonly display?: Extract<InboxVisibilityDecision, { readonly visible: true }>['display'];
  // #endregion
}

/** Candidates selected for the page before actor enrichment. */
interface VisiblePage {
  // #region Properties
  /** The permitted records within the requested size. */
  readonly items: readonly VisibleCandidate[];

  /** Continuation before the first excluded visible candidate. */
  readonly nextCursor: string | null;
  // #endregion
}

/** Requests display only from the owner of the current task and optional comment. */
function toVisibilityInput(record: InboxCandidate): readonly InboxVisibilityInput[] {
  const subject = record.subject;
  if (subject === null) return [];
  if (subject.kind === 'list' || subject.kind === 'space') return [{ subject }];
  return [
    { subject, display: record.commentId === undefined ? {} : { commentId: record.commentId } },
  ];
}

/** Guards the public boundary against missing or unrelated task and excerpt data. */
function checkDisplay(record: InboxCandidate, display: VisibleCandidate['display']): void {
  const subject = record.subject;
  if (subject?.kind !== 'task-id' && subject?.kind !== 'task-key') {
    if (display !== undefined) throw new InboxUnavailable('task-service');
    return;
  }
  if (
    display === undefined ||
    (subject.kind === 'task-key' && subject.taskKey !== display.taskKey) ||
    (subject.kind === 'task-id' && subject.taskId.toLowerCase() !== display.taskId.toLowerCase()) ||
    (record.commentId === undefined) !== (display.commentExcerpt === undefined)
  ) {
    throw new InboxUnavailable('task-service');
  }
}

/** Composes a stable authorized page, its permitted actor names and the unread badge. */
export class ListInboxNotifications {
  // #region Constructor
  /** Binds the private owner data and the services that authorize and enrich it. */
  public constructor(
    private readonly source: Pick<InboxNotificationSource, 'listCandidates'>,
    private readonly visibility: InboxSubjectVisibility,
    private readonly names: InboxActorNames,
    private readonly unread: ScanInboxUnread,
    private readonly cursors: InboxPageCursor,
  ) {}
  // #endregion

  // #region Methods
  /** Opens the owner's continuation before scanning the page and badge within one budget. */
  public async execute(
    query: InboxListQuery,
    owner: Omit<InboxCursorScope, 'state'>,
    budgetMs?: number,
  ): Promise<InboxPage> {
    const scope: InboxCursorScope = { ...owner, state: query.state };
    const cursor = query.cursor === null ? null : this.cursors.open(query.cursor, scope);
    if (query.cursor !== null && cursor === null) throw new InvalidInboxCursor();

    return withInboxBudget(async (signal) => {
      const [page, unreadCount] = await Promise.all([
        this.page({ ...query, cursor }, signal).then(async ({ items, nextCursor }) => ({
          items: await this.enrich(items, signal),
          nextCursor,
        })),
        this.unread.retry(signal, async () => (await this.unread.execute(signal)).unreadCount),
      ]);
      const nextCursor =
        page.nextCursor === null ? null : this.cursors.seal(page.nextCursor, scope);
      if (page.nextCursor !== null && nextCursor === null)
        throw new InboxUnavailable('notification-service');
      return { items: page.items, nextCursor, unreadCount };
    }, budgetMs);
  }

  /** Keeps the cursor immediately before the first visible item outside the page. */
  private async page(query: InboxListQuery, signal: AbortSignal): Promise<VisiblePage> {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > BATCH_SIZE) {
      throw new RangeError('The inbox page size must be between 1 and 100.');
    }
    const visible: VisibleCandidate[] = [];
    let cursor = query.cursor;
    let lastConsumed = cursor;
    const seenCursors = new Set(cursor === null ? [] : [cursor]);

    for (;;) {
      signal.throwIfAborted();
      const batch: Awaited<ReturnType<InboxNotificationSource['listCandidates']>> =
        await this.source.listCandidates({ state: query.state, cursor, limit: BATCH_SIZE }, signal);
      signal.throwIfAborted();
      if (
        batch.items.length > BATCH_SIZE ||
        (batch.nextCursor !== null && batch.items.length === 0)
      ) {
        throw new InboxUnavailable('notification-service');
      }

      const inputs = batch.items.flatMap(({ record }) => toVisibilityInput(record));
      const decisions = inputs.length === 0 ? [] : await this.visibility.resolve(inputs, signal);
      signal.throwIfAborted();
      if (decisions.length !== inputs.length) throw new InboxUnavailable('task-service');

      let index = 0;
      for (const { record, cursorAfter } of batch.items) {
        if (cursorAfter.length === 0 || cursorAfter === lastConsumed) {
          throw new InboxUnavailable('notification-service');
        }
        const decision = record.subject === null ? { visible: true as const } : decisions[index++];
        if (decision?.visible) {
          checkDisplay(record, decision.display);
          if (visible.length === query.limit) return { items: visible, nextCursor: lastConsumed };
          visible.push({ record, display: decision.display });
        }
        lastConsumed = cursorAfter;
      }

      cursor = batch.nextCursor;
      if (cursor === null) return { items: visible, nextCursor: null };
      if (seenCursors.has(cursor)) throw new InboxUnavailable('notification-service');
      seenCursors.add(cursor);
    }
  }

  /** Resolves member names only for already authorized linked items included in the page. */
  private async enrich(
    items: readonly VisibleCandidate[],
    signal: AbortSignal,
  ): Promise<readonly InboxNotification[]> {
    signal.throwIfAborted();
    const actorIds = [
      ...new Set(
        items.flatMap(({ record }) =>
          record.subject === null || record.actorUserId === null
            ? []
            : [record.actorUserId.toLowerCase()],
        ),
      ),
    ];
    const names = actorIds.length === 0 ? [] : (await this.names.lookup(actorIds, signal)).items;
    signal.throwIfAborted();
    const byAccount = new Map(names.map(({ userId, name }) => [userId.toLowerCase(), name]));

    return items.map(({ record, display }): InboxNotification => {
      const userId = record.subject === null ? undefined : record.actorUserId?.toLowerCase();
      const name = userId === undefined ? undefined : byAccount.get(userId);
      return {
        id: record.id,
        kind: record.kind,
        actor: userId === undefined || name === undefined ? null : { userId, name },
        task: display === undefined ? null : { taskKey: display.taskKey, name: display.taskName },
        excerpt: display?.commentExcerpt ?? null,
        status: display === undefined ? null : (record.status ?? null),
        createdAt: record.createdAt,
        readAt: record.readAt,
        archivedAt: record.archivedAt,
        version: record.version,
      };
    });
  }
  // #endregion
}
