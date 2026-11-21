import type { AttachmentRegistry } from '../../../../ports/outbound/storage-service/attachment/attachment-registry.port.js';

/** Authorizes and relays the attachment operation. */
export class GetAttachmentDownload {
  // #region Constructor
  /** Binds the attachment registry. */
  public constructor(private readonly registry: AttachmentRegistry) {}
  // #endregion

  // #region Methods
  /** Checks the current task before requesting the attachment. */
  public async execute(taskKey: string, attachmentId: string): Promise<object> {
    await this.registry.authorize(taskKey, 'read');
    return this.registry.download(taskKey, attachmentId);
  }
  // #endregion
}
