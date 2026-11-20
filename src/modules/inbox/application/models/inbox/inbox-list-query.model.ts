/** Validated owner-scoped filter, page size and private continuation. */
export interface InboxListQuery {
  // #region Properties
  /** Inbox membership filter. */
  readonly state: 'active' | 'unread' | 'archived';

  /** Opaque Notification cursor bound to the authenticated owner and filter. */
  readonly cursor: string | null;

  /** Maximum returned items, between one and 100. */
  readonly limit: number;
  // #endregion
}
