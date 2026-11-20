/** A checked reminder record returned by Notification. */
export interface ReminderRecord {
  // #region Properties
  /** Reminder identity. */
  readonly id: string;
  readonly taskId: string;
  readonly remindAt: string;
  readonly note: string | null;
  readonly firedAt: string | null;
  readonly completedAt: string | null;
  readonly version: number;
  // #endregion
}
