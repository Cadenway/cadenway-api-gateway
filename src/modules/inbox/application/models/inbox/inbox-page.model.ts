import type { InboxNotification } from './inbox-notification.model.js';

/** Authorized page and the independent count for the active inbox. */
export interface InboxPage {
  // #region Properties
  /** Items in Notification's original ordering. */
  readonly items: readonly InboxNotification[];

  /** Encrypted public continuation scoped to the verified owner and filter. */
  readonly nextCursor: string | null;

  /** Number of accessible active unread notifications. */
  readonly unreadCount: number;
  // #endregion
}
