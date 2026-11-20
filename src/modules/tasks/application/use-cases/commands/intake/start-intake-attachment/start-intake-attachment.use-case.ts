import type { IntakeAttachments } from '../../../../ports/outbound/storage-service/intake/intake-attachments.port.js';

/** Obtains the applicant's temporary upload capability. */
export class StartIntakeAttachment {
  // #region Constructor
  /** Binds the owning transports for intake attachments. */
  public constructor(private readonly attachments: IntakeAttachments) {}
  // #endregion

  // #region Methods
  /** Allocates the reservation with Task before asking Storage to sign it. */
  public async execute(
    publicKey: string,
    body: object,
    draftKey: string,
    key: string,
  ): Promise<object> {
    const proof = await this.attachments.allocate(publicKey, body, draftKey, key);
    return this.attachments.start(proof, body);
  }
  // #endregion
}
