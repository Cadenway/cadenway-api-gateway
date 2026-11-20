import type { InboxSubject } from '../../../../models/inbox/inbox-subject.model.js';

/** Complete unread scan for one owner generation after Task visibility checks. */
export interface ScanInboxUnreadOutput {
  // #region Properties
  /** The generation sampled consistently across the scan. */
  readonly generation: string;

  /** The count of records whose exact group was authorized. */
  readonly unreadCount: number;

  /** The exact linked selectors to use in an optional read-all write. */
  readonly authorizedSubjects: readonly InboxSubject[];
  // #endregion
}
