import type { ReminderListPosition } from '../../../../models/reminder/reminder-list-position.model.js';
import type { ReminderListRequest } from '../../../../models/reminder/reminder-list-request.model.js';

type Owner = Pick<ReminderListRequest, 'organizationId' | 'userId'>;

/** Authenticates an opaque reminder position against the verified owner scope. */
export interface ReminderPageCursor {
  // #region Methods
  /** Seals the last returned position without binding it to a transient generation. */
  seal(position: ReminderListPosition, scope: Owner): string | null;

  /** Opens a valid cursor for this scope or returns null. */
  open(cursor: string, scope: Owner): ReminderListPosition | null;
  // #endregion
}
