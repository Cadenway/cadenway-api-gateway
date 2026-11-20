/** Counts read in the same transaction that marked the selected notifications. */
export interface InboxReadAllResult {
  // #region Properties
  /** Newly read notifications. */
  readonly markedRead: number;

  /** Remaining accessible active unread notifications. */
  readonly unreadCount: number;
  // #endregion
}
