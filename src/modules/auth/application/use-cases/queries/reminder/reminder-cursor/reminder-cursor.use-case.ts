import type { ReminderCursorScope } from '../../../../models/reminder/reminder-cursor-scope.model.js';
import type { ReminderCursorCodec } from '../../../../ports/outbound/crypto/reminder/reminder-cursor-codec.port.js';

/** Protects personal reminder positions that cross the public API. */
export class ReminderCursor {
  // #region Constructor
  /** Binds the owner-scoped cursor codec. */
  public constructor(private readonly codec: ReminderCursorCodec) {}
  // #endregion

  // #region Methods
  /** Seals or opens the cursor for the verified owner, returning null when unusable. */
  public execute(
    action: 'seal' | 'open',
    cursor: string,
    scope: ReminderCursorScope,
  ): string | null {
    return action === 'seal' ? this.codec.seal(cursor, scope) : this.codec.open(cursor, scope);
  }
  // #endregion
}
