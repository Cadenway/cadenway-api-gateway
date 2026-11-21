import type { IntakeAttachments } from '../../../../ports/outbound/storage-service/intake/intake-attachments.port.js';

/** Requests verification of the applicant's object. */
export class CompleteIntakeAttachment {
  // #region Constructor
  /** Binds the owning transports for intake attachments. */
  public constructor(private readonly attachments: IntakeAttachments) {}
  // #endregion

  // #region Methods
  /** Resolves the authorized reservation before requesting Storage verification. */
  public async execute(publicKey: string, attachmentId: string, draftKey: string): Promise<object> {
    const proof = await this.attachments.resolve(publicKey, attachmentId, draftKey);
    return this.attachments.complete(proof);
  }
  // #endregion
}
