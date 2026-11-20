import type { DocumentListQuery } from '../../../../models/documents/document-list-query.model.js';
import type { DocumentsPort } from '../../../../ports/outbound/document-service/documents/documents.port.js';

/** Relays the list documents operation. */
export class ListDocuments {
  // #region Constructor
  /** Binds the document service port. */
  public constructor(private readonly documents: DocumentsPort) {}
  // #endregion

  // #region Methods
  /** Runs the operation for the verified caller. */
  public execute(query: DocumentListQuery): Promise<object> {
    return this.documents.list(query);
  }
  // #endregion
}
