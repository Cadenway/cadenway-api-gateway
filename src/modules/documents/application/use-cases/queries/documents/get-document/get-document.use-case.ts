import type { DocumentsPort } from '../../../../ports/outbound/document-service/documents/documents.port.js';

/** Relays the get document operation. */
export class GetDocument {
  // #region Constructor
  /** Binds the document service port. */
  public constructor(private readonly documents: DocumentsPort) {}
  // #endregion

  // #region Methods
  /** Runs the operation for the verified caller. */
  public execute(documentId: string): Promise<object> {
    return this.documents.get(documentId);
  }
  // #endregion
}
