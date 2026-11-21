import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { DocumentServiceClient } from '../../clients/document-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { DocumentsPort } from './application/ports/outbound/document-service/documents/documents.port.js';
import { CreateDocument } from './application/use-cases/commands/documents/create-document/create-document.use-case.js';
import { DeleteDocument } from './application/use-cases/commands/documents/delete-document/delete-document.use-case.js';
import { UpdateDocument } from './application/use-cases/commands/documents/update-document/update-document.use-case.js';
import { GetDocument } from './application/use-cases/queries/documents/get-document/get-document.use-case.js';
import { ListDocuments } from './application/use-cases/queries/documents/list-documents/list-documents.use-case.js';
import { createDocumentRegistryAdapter } from './infrastructure/adapters/document-service/documents/document-registry.adapter.js';
import { DocumentsController } from './presentation/http/controllers/documents/documents.controller.js';

const DOCUMENTS = Symbol('DOCUMENTS');

/** Composes the session-only document endpoints with the generated upstream client. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [DocumentsController],
  providers: [
    {
      provide: DOCUMENTS,
      inject: [DocumentServiceClient],
      useFactory: createDocumentRegistryAdapter,
    },
    {
      provide: ListDocuments,
      inject: [DOCUMENTS],
      useFactory: (documents: DocumentsPort) => new ListDocuments(documents),
    },
    {
      provide: CreateDocument,
      inject: [DOCUMENTS],
      useFactory: (documents: DocumentsPort) => new CreateDocument(documents),
    },
    {
      provide: GetDocument,
      inject: [DOCUMENTS],
      useFactory: (documents: DocumentsPort) => new GetDocument(documents),
    },
    {
      provide: UpdateDocument,
      inject: [DOCUMENTS],
      useFactory: (documents: DocumentsPort) => new UpdateDocument(documents),
    },
    {
      provide: DeleteDocument,
      inject: [DOCUMENTS],
      useFactory: (documents: DocumentsPort) => new DeleteDocument(documents),
    },
  ],
})
export class DocumentsModule {}
