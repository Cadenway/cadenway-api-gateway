/** Public reminder after current Task access has been checked. */
export interface PublicReminder {
  // #region Properties
  /** Reminder identity. */
  readonly id: string;
  readonly taskKey: string;
  readonly taskName: string;
  readonly remindAt: string;
  readonly note: string | null;
  readonly firedAt: string | null;
  readonly completedAt: string | null;
  readonly version: number;
  // #endregion
}
