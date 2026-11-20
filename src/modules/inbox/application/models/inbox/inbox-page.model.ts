import type { InboxNotification } from './inbox-notification.model.js';

/** Authorized page and the independent count for the active inbox. */
export interface InboxPage {
  // #region Properties
  /** Items in Notification's original ordering. */
  readonly items: readonly InboxNotification[];

  /** Private continuation for the gateway to expose as an opaque cursor. */
  readonly nextCursor: string | null;

  /** Number of accessible active unread notifications. */
  readonly unreadCount: number;
  // #endregion
}
