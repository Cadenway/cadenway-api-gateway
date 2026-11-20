import type { KeyObject } from 'node:crypto';

import type { ReminderCursorScope } from '../../../application/models/reminder/reminder-cursor-scope.model.js';
import type { ReminderCursorCodec } from '../../../application/ports/outbound/crypto/reminder/reminder-cursor-codec.port.js';
import { Ed25519CursorEnvelope } from './ed25519-cursor-envelope.adapter.js';

/** Signs reminders positions within a domain dedicated to personal reminders. */
export class Ed25519ReminderCursor implements ReminderCursorCodec {
  // #region Properties
  /** The versioned envelope for reminders cursors. */
  private readonly envelope: Ed25519CursorEnvelope;
  // #endregion

  // #region Constructor
  /** Binds the configured signing key to the reminders cursor domain. */
  public constructor(signingKey: KeyObject) {
    this.envelope = new Ed25519CursorEnvelope(
      signingKey,
      'cadenway-api-gateway/reminder-cursor/v1',
    );
  }
  // #endregion

  // #region Methods
  /** Signs the position for the verified tenant and account. */
  public seal(innerCursor: string, scope: ReminderCursorScope): string | null {
    return this.envelope.seal(innerCursor, [scope.organizationId, scope.userId]);
  }

  /** Opens the position only for the verified tenant and account. */
  public open(cursor: string, scope: ReminderCursorScope): string | null {
    return this.envelope.open(cursor, [scope.organizationId, scope.userId]);
  }
  // #endregion
}
