import type { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { IntakeAttachments } from '../../../../application/ports/outbound/storage-service/intake/intake-attachments.port.js';

/** Binds the intake attachment port to the clients of its owning services. */
export function createIntakeAttachments(
  task: TaskServiceClient,
  storage: StorageServiceClient,
): IntakeAttachments {
  return {
    allocate: (publicKey, body, draftKey, key) =>
      task.allocateIntakeAttachment(publicKey, body, draftKey, key),
    resolve: (publicKey, attachmentId, draftKey) =>
      task.resolveIntakeAttachment(publicKey, attachmentId, draftKey),
    release: (publicKey, attachmentId, draftKey) =>
      task.releaseIntakeAttachment(publicKey, attachmentId, draftKey),
    start: (binding, body) => storage.startIntakeAttachmentUpload(binding, body),
    complete: (binding) => storage.completeIntakeAttachmentUpload(binding),
  };
}
