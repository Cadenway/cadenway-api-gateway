import type { InboxListQuery } from './inbox-list-query.model.js';

/** The verified owner and effective filter of a public Inbox page. */
export interface InboxCursorScope {
  // #region Properties
  /** Account whose inbox is being listed. */
  readonly userId: string;

  /** Selected organization verified by the credential guard. */
  readonly organizationId: string;

  /** Effective state after applying the public default. */
  readonly state: InboxListQuery['state'];
  // #endregion
}
