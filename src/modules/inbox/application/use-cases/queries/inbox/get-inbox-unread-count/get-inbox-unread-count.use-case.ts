import { withInboxBudget } from '../../../../models/inbox/inbox-work-budget.model.js';
import type { ScanInboxUnread } from '../scan-inbox-unread/scan-inbox-unread.use-case.js';

/** Builds the badge from every authorized active unread group. */
export class GetInboxUnreadCount {
  // #region Constructor
  /** Binds the same unread scan used by the inbox list and read-all. */
  public constructor(private readonly unread: ScanInboxUnread) {}
  // #endregion

  // #region Methods
  /** Returns a complete count or propagates the reason a complete scan was impossible. */
  public execute(budgetMs?: number): Promise<{ readonly unreadCount: number }> {
    return withInboxBudget(
      (signal) =>
        this.unread.retry(signal, async () => ({
          unreadCount: (await this.unread.execute(signal)).unreadCount,
        })),
      budgetMs,
    );
  }
  // #endregion
}
