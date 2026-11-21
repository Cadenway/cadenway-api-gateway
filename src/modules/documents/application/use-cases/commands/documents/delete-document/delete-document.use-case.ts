import type { DocumentsPort } from '../../../../ports/outbound/document-service/documents/documents.port.js';

/** Relays the delete document operation. */
export class DeleteDocument {
  // #region Constructor
  /** Binds the document service port. */
  public constructor(private readonly documents: DocumentsPort) {}
  // #endregion

  // #region Methods
  /** Runs the operation for the verified caller. */
  public execute(documentId: string, ifMatch: string): Promise<void> {
    return this.documents.remove(documentId, ifMatch);
  }
  // #endregion
}
