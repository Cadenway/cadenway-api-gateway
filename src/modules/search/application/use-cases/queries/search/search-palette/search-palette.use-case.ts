import type { SearchQuery } from '../../../../models/search/search-query.model.js';
import type { SearchPort } from '../../../../ports/outbound/search-service/search/search.port.js';

/** Relays a palette query for the verified session. */
export class SearchPalette {
  // #region Constructor
  /** Binds the Search service port. */
  public constructor(private readonly search: SearchPort) {}
  // #endregion

  // #region Methods
  /** Runs the query in the current request context. */
  public execute(query: SearchQuery): Promise<object> {
    return this.search.search(query);
  }
  // #endregion
}
