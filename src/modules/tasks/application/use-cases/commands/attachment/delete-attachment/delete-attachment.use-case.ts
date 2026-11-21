import type { AttachmentRegistry } from '../../../../ports/outbound/storage-service/attachment/attachment-registry.port.js';

/** Authorizes and relays the attachment operation. */
export class DeleteAttachment {
  // #region Constructor
  /** Binds the attachment registry. */
  public constructor(private readonly registry: AttachmentRegistry) {}
  // #endregion

  // #region Methods
  /** Checks the current task before requesting the attachment. */
  public async execute(
    taskKey: string,
    attachmentId: string,
    ifMatch: string | undefined,
  ): Promise<void> {
    await this.registry.authorize(taskKey, 'write');
    return this.registry.remove(taskKey, attachmentId, ifMatch);
  }
  // #endregion
}
