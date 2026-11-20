/** Validated owner-scoped filter, page size and continuation. */
export interface InboxListQuery {
  // #region Properties
  /** Inbox membership filter. */
  readonly state: 'active' | 'unread' | 'archived';

  /** Gateway cursor at the use case boundary and Notification cursor at its source. */
  readonly cursor: string | null;

  /** Maximum returned items, between one and 100. */
  readonly limit: number;
  // #endregion
}
