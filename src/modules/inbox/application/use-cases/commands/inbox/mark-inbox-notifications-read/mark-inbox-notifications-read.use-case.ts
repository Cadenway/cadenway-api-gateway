import type { InboxReadAllResult } from '../../../../models/inbox/inbox-read-all-result.model.js';
import { InboxUnavailable } from '../../../../models/inbox/inbox-unavailable.model.js';
import { withInboxBudget } from '../../../../models/inbox/inbox-work-budget.model.js';
import type { InboxNotificationSource } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { ScanInboxUnread } from '../../../queries/inbox/scan-inbox-unread/scan-inbox-unread.use-case.js';

/** Authorizes the exact unread subject selection and lets Notification mark it atomically. */
export class MarkInboxNotificationsRead {
  // #region Constructor
  /** Binds the owner-scoped command and its read-only preparation. */
  public constructor(
    private readonly source: Pick<InboxNotificationSource, 'markReadAll'>,
    private readonly unread: ScanInboxUnread,
  ) {}
  // #endregion

  // #region Methods
  /** Preserves the initial creation cutoff over generation conflicts and retries. */
  public execute(budgetMs?: number): Promise<InboxReadAllResult> {
    let creationCutoff: string | undefined;
    return withInboxBudget(
      (signal) =>
        this.unread.retry(signal, async () => {
          const { generation, authorizedSubjects } = await this.unread.execute(
            signal,
            (observed) => {
              creationCutoff ??= observed;
            },
          );
          if (creationCutoff === undefined || BigInt(generation) < BigInt(creationCutoff)) {
            throw new InboxUnavailable('notification-service');
          }
          signal.throwIfAborted();
          return this.source.markReadAll(
            { snapshotGeneration: generation, creationCutoff, authorizedSubjects },
            signal,
          );
        }),
      budgetMs,
    );
  }
  // #endregion
}
