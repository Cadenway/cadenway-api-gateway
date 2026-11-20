import type { InboxCursorScope } from '../../../../models/inbox/inbox-cursor-scope.model.js';

/** Protects a private Notification continuation at the public API boundary. */
export interface InboxPageCursor {
  // #region Methods
  /** Encrypts an internal cursor or returns null if its size is outside the supported range. */
  seal(cursor: string, scope: InboxCursorScope): string | null;

  /** Authenticates and decrypts a cursor issued for exactly this owner and filter. */
  open(cursor: string, scope: InboxCursorScope): string | null;
  // #endregion
}
