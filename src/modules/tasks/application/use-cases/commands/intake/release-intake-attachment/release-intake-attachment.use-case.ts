import type { IntakeAttachments } from '../../../../ports/outbound/storage-service/intake/intake-attachments.port.js';

/** Requests release of an unused intake attachment. */
export class ReleaseIntakeAttachment {
  // #region Constructor
  /** Binds the owning transports for intake attachments. */
  public constructor(private readonly attachments: IntakeAttachments) {}
  // #endregion

  // #region Methods
  /** Relays the release to Task, which commits it with its outbox fact. */
  public execute(publicKey: string, attachmentId: string, draftKey: string): Promise<void> {
    return this.attachments.release(publicKey, attachmentId, draftKey);
  }
  // #endregion
}
