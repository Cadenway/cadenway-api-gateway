import type { IntakeAttachmentBinding } from '../../../../models/intake/intake-attachment-binding.model.js';

/** Coordinates the owning services for an anonymous upload. */
export interface IntakeAttachments {
  // #region Methods
  /** Reserves one attachment on the authorized publication and draft in Task. */
  allocate(
    publicKey: string,
    body: object,
    draftKey: string,
    key: string,
  ): Promise<IntakeAttachmentBinding>;

  /** Obtains the current Task proof required to verify a specific reservation. */
  resolve(
    publicKey: string,
    attachmentId: string,
    draftKey: string,
  ): Promise<IntakeAttachmentBinding>;

  /** Releases the reservation through Task and its outbox. */
  release(publicKey: string, attachmentId: string, draftKey: string): Promise<void>;

  /** Signs the upload previously allocated by Task. */
  start(binding: IntakeAttachmentBinding, body: object): Promise<object>;

  /** Verifies the same reservation in Storage after Task authorizes it. */
  complete(binding: IntakeAttachmentBinding): Promise<object>;
  // #endregion
}
