import type { DocumentUpdateBody } from '../../../../models/documents/document-update-body.model.js';
import type { DocumentsPort } from '../../../../ports/outbound/document-service/documents/documents.port.js';

/** Relays the update document operation. */
export class UpdateDocument {
  // #region Constructor
  /** Binds the document service port. */
  public constructor(private readonly documents: DocumentsPort) {}
  // #endregion

  // #region Methods
  /** Runs the operation for the verified caller. */
  public execute(documentId: string, body: DocumentUpdateBody, ifMatch: string): Promise<object> {
    return this.documents.update(documentId, body, ifMatch);
  }
  // #endregion
}
