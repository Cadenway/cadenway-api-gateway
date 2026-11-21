import type { DocumentCreateBody } from '../../../../models/documents/document-create-body.model.js';
import type { DocumentsPort } from '../../../../ports/outbound/document-service/documents/documents.port.js';

/** Relays the create document operation. */
export class CreateDocument {
  // #region Constructor
  /** Binds the document service port. */
  public constructor(private readonly documents: DocumentsPort) {}
  // #endregion

  // #region Methods
  /** Runs the operation for the verified caller. */
  public execute(body: DocumentCreateBody, key: string | undefined): Promise<object> {
    return this.documents.create(body, key);
  }
  // #endregion
}
