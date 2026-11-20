import type { InboxSubject } from './inbox-subject.model.js';

/** One Task authorization check, optionally including authorized display data. */
export interface InboxVisibilityInput {
  // #region Properties
  /** Exact private selector to check for the authenticated recipient. */
  readonly subject: InboxSubject;

  /** When present, requests only the task display and the indicated comment if any. */
  readonly display?: { readonly commentId?: string };
  // #endregion
}
