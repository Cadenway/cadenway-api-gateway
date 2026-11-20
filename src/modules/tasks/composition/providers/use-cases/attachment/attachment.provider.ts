import type { FactoryProvider } from '@nestjs/common';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import type { AttachmentRegistry } from '../../../../application/ports/outbound/storage-service/attachment/attachment-registry.port.js';
import { createAttachmentRegistry } from '../../../../infrastructure/adapters/storage-service/attachment/attachment-registry.adapter.js';
import { ListAttachments } from '../../../../application/use-cases/queries/attachment/list-attachments/list-attachments.use-case.js';
import { StartAttachmentUpload } from '../../../../application/use-cases/commands/attachment/start-attachment-upload/start-attachment-upload.use-case.js';
import { GetAttachment } from '../../../../application/use-cases/queries/attachment/get-attachment/get-attachment.use-case.js';
import { CompleteAttachmentUpload } from '../../../../application/use-cases/commands/attachment/complete-attachment-upload/complete-attachment-upload.use-case.js';
import { GetAttachmentDownload } from '../../../../application/use-cases/queries/attachment/get-attachment-download/get-attachment-download.use-case.js';
import { DeleteAttachment } from '../../../../application/use-cases/commands/attachment/delete-attachment/delete-attachment.use-case.js';

const ATTACHMENT_REGISTRY = Symbol('AttachmentRegistry');

/** Binds the six attachment operations to the Task and Storage transports. */
export const attachmentProviders: readonly FactoryProvider[] = [
  {
    provide: ATTACHMENT_REGISTRY,
    inject: [TaskServiceClient, StorageServiceClient],
    useFactory: createAttachmentRegistry,
  },
  {
    provide: ListAttachments,
    inject: [ATTACHMENT_REGISTRY],
    useFactory: (registry: AttachmentRegistry): ListAttachments => new ListAttachments(registry),
  },
  {
    provide: StartAttachmentUpload,
    inject: [ATTACHMENT_REGISTRY],
    useFactory: (registry: AttachmentRegistry): StartAttachmentUpload =>
      new StartAttachmentUpload(registry),
  },
  {
    provide: GetAttachment,
    inject: [ATTACHMENT_REGISTRY],
    useFactory: (registry: AttachmentRegistry): GetAttachment => new GetAttachment(registry),
  },
  {
    provide: CompleteAttachmentUpload,
    inject: [ATTACHMENT_REGISTRY],
    useFactory: (registry: AttachmentRegistry): CompleteAttachmentUpload =>
      new CompleteAttachmentUpload(registry),
  },
  {
    provide: GetAttachmentDownload,
    inject: [ATTACHMENT_REGISTRY],
    useFactory: (registry: AttachmentRegistry): GetAttachmentDownload =>
      new GetAttachmentDownload(registry),
  },
  {
    provide: DeleteAttachment,
    inject: [ATTACHMENT_REGISTRY],
    useFactory: (registry: AttachmentRegistry): DeleteAttachment => new DeleteAttachment(registry),
  },
];
