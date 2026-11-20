/** The public projection and its complete owner-scoped access count. */
export interface ReminderListPage {
  // #region Properties
  /** Pending reminders checked with Task and enriched for display. */
  readonly items: readonly {
    readonly id: string;
    readonly taskKey: string;
    readonly taskName: string;
    readonly remindAt: string;
    readonly note: string | null;
    readonly firedAt: string | null;
    readonly completedAt: null;
    readonly version: number;
  }[];

  /** The opaque position of the last returned item if another is visible. */
  readonly nextCursor: string | null;

  /** The accessible pending count across the complete scan, including overdue reminders. */
  readonly pendingCount: number;
  // #endregion
}
