import type { ReminderCursorScope } from '../../../../models/reminder/reminder-cursor-scope.model.js';

/** Authenticates the cursor for one reminders owner. */
export interface ReminderCursorCodec {
  // #region Methods
  /** Signs the encoded reminder position for the verified owner. */
  seal(cursor: string, scope: ReminderCursorScope): string | null;

  /** Opens a public cursor only if its signature matches the verified owner. */
  open(cursor: string, scope: ReminderCursorScope): string | null;
  // #endregion
}
