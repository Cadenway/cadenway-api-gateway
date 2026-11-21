import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import type { AttachmentRegistry } from '../../../../application/ports/outbound/storage-service/attachment/attachment-registry.port.js';

/** Binds the local registry to signed Task and Storage clients. */
export function createAttachmentRegistry(
  tasks: TaskServiceClient,
  storage: StorageServiceClient,
): AttachmentRegistry {
  return {
    authorize: (taskKey, mode) => tasks.checkTaskAttachmentAccess(taskKey, mode),
    list: (taskKey, query) => storage.listTaskAttachments(taskKey, query),
    start: (taskKey, body, key) => storage.startTaskAttachmentUpload(taskKey, body, key),
    get: (taskKey, attachmentId) => storage.getTaskAttachment(taskKey, attachmentId),
    complete: (taskKey, attachmentId) =>
      storage.completeTaskAttachmentUpload(taskKey, attachmentId),
    download: (taskKey, attachmentId) => storage.getTaskAttachmentDownload(taskKey, attachmentId),
    remove: (taskKey, attachmentId, ifMatch) =>
      storage.deleteTaskAttachment(taskKey, attachmentId, ifMatch),
  };
}
