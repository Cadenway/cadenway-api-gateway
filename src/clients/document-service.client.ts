import * as schemas from '@cadenway/contracts/validators/internal/document-service';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import type { z } from 'zod';

import {
  answered,
  expectBody,
  expectStatus,
  outsideContract,
  type GeneratedResponse,
} from '../problems/upstream-answer.js';
import { getDocumentServiceInternalRoutes } from './generated/document-service.js';

/** Audience and upstream name of the signed Document client. */
export const DOCUMENT_SERVICE: string = 'document-service';

type Routes = ReturnType<typeof getDocumentServiceInternalRoutes>;
type Response = GeneratedResponse & { readonly headers: Headers };
type DocumentDetail = z.output<typeof schemas.GetDocumentInternalResponse>;

/** Calls the generated Document routes through the signed internal transport. */
export class DocumentServiceClient {
  // #region Properties
  /** The contract-generated routes bound to the shared transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the configured Document transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getDocumentServiceInternalRoutes((input, init) => {
      if (typeof input !== 'string') throw new Error('The Document client requires a path.');
      return http.fetch(input, init);
    });
  }
  // #endregion

  // #region Methods
  /** Lists metadata whose current visibility has been checked by Document. */
  public async listDocuments(
    params: z.input<typeof schemas.ListDocumentsInternalQueryParams>,
  ): Promise<z.output<typeof schemas.ListDocumentsInternalResponse>> {
    const operation = 'listDocumentsInternal';
    const query = schemas.ListDocumentsInternalQueryParams.parse(params);
    const response = await answered(
      DOCUMENT_SERVICE,
      operation,
      this.routes.listDocumentsInternal(query),
    );
    this.noStore(operation, response);
    const page = expectBody(
      DOCUMENT_SERVICE,
      operation,
      response,
      200,
      schemas.ListDocumentsInternalResponse,
    );
    const ids = new Set(page.items.map((item) => item.id.toLowerCase()));
    if (page.items.length > query.limit || ids.size !== page.items.length) {
      throw outsideContract(DOCUMENT_SERVICE, operation, 'an invalid page');
    }
    return page;
  }

  /** Creates a document or replays the original result for the supplied key. */
  public async createDocument(
    body: z.input<typeof schemas.CreateDocumentInternalBody>,
    idempotencyKey?: string,
  ): Promise<DocumentDetail> {
    const operation = 'createDocumentInternal';
    const request = schemas.CreateDocumentInternalBody.parse(body);
    const options: InternalRequestInit = {
      idempotent: false,
      ...(idempotencyKey === undefined ? {} : { headers: { 'Idempotency-Key': idempotencyKey } }),
    };
    const response = await answered(
      DOCUMENT_SERVICE,
      operation,
      this.routes.createDocumentInternal(request, options),
    );
    const document = this.detail(operation, response, 201, schemas.CreateDocumentInternalResponse);
    if (response.headers.get('Location') !== `/internal/v1/documents/${document.id}`) {
      throw outsideContract(DOCUMENT_SERVICE, operation, 'an inconsistent Location');
    }
    if (document.spaceId.toLowerCase() !== request.spaceId.toLowerCase()) {
      throw outsideContract(DOCUMENT_SERVICE, operation, 'a mismatched document space');
    }
    return document;
  }

  /** Reads a document under its current direct-space proof. */
  public async getDocument(id: string): Promise<DocumentDetail> {
    const operation = 'getDocumentInternal';
    const { documentId } = schemas.GetDocumentInternalParams.parse({ documentId: id });
    const response = await answered(
      DOCUMENT_SERVICE,
      operation,
      this.routes.getDocumentInternal(documentId),
    );
    const document = this.detail(operation, response, 200, schemas.GetDocumentInternalResponse);
    return this.checkId(operation, document, documentId);
  }

  /** Updates supplied fields once under the caller's strong version. */
  public async updateDocument(
    id: string,
    body: z.input<typeof schemas.UpdateDocumentInternalBody>,
    ifMatch: string,
  ): Promise<DocumentDetail> {
    const operation = 'updateDocumentInternal';
    const { documentId } = schemas.GetDocumentInternalParams.parse({ documentId: id });
    const options: InternalRequestInit = { idempotent: false, headers: { 'If-Match': ifMatch } };
    const response = await answered(
      DOCUMENT_SERVICE,
      operation,
      this.routes.updateDocumentInternal(
        documentId,
        schemas.UpdateDocumentInternalBody.parse(body),
        options,
      ),
    );
    const document = this.detail(operation, response, 200, schemas.UpdateDocumentInternalResponse);
    return this.checkId(operation, document, documentId);
  }

  /** Deletes a document once under the caller's strong version. */
  public async deleteDocument(id: string, ifMatch: string): Promise<void> {
    const operation = 'deleteDocumentInternal';
    const { documentId } = schemas.GetDocumentInternalParams.parse({ documentId: id });
    const options: InternalRequestInit = { idempotent: false, headers: { 'If-Match': ifMatch } };
    const response = await answered(
      DOCUMENT_SERVICE,
      operation,
      this.routes.deleteDocumentInternal(documentId, options),
    );
    this.noStore(operation, response);
    expectStatus(DOCUMENT_SERVICE, operation, response, 204);
  }

  /** Rejects a missing cache policy before forwarding a successful result. */
  private noStore(operation: string, response: Response): void {
    if (response.headers.get('Cache-Control')?.toLowerCase() !== 'private, no-store') {
      throw outsideContract(DOCUMENT_SERVICE, operation, 'missing private no-store');
    }
  }

  /** Validates a detail and its strong ETag together. */
  private detail<T extends z.ZodType<{ readonly id: string; readonly version: number }>>(
    operation: string,
    response: Response,
    status: number,
    schema: T,
  ): z.output<T> {
    this.noStore(operation, response);
    const document = expectBody(DOCUMENT_SERVICE, operation, response, status, schema);
    if (response.headers.get('ETag') !== `"${String(document.version)}"`) {
      throw outsideContract(DOCUMENT_SERVICE, operation, 'an inconsistent ETag');
    }
    return document;
  }

  /** Prevents a response for another document from reaching the caller. */
  private checkId<T extends { readonly id: string }>(
    operation: string,
    document: T,
    id: string,
  ): T {
    if (document.id.toLowerCase() !== id.toLowerCase()) {
      throw outsideContract(DOCUMENT_SERVICE, operation, 'a mismatched document id');
    }
    return document;
  }
  // #endregion
}
