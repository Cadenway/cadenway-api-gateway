import type { DocumentCreateBody } from '../../../../models/documents/document-create-body.model.js';
import type { DocumentListQuery } from '../../../../models/documents/document-list-query.model.js';
import type { DocumentUpdateBody } from '../../../../models/documents/document-update-body.model.js';

/** Calls the document service for the verified caller. */
export interface DocumentsPort {
  // #region Methods
  /** Lists documents. */
  list(query: DocumentListQuery): Promise<object>;

  /** Creates a document. */
  create(body: DocumentCreateBody, key: string | undefined): Promise<object>;

  /** Reads a document. */
  get(documentId: string): Promise<object>;

  /** Updates a document. */
  update(documentId: string, body: DocumentUpdateBody, ifMatch: string): Promise<object>;

  /** Deletes a document. */
  remove(documentId: string, ifMatch: string): Promise<void>;
  // #endregion
}
