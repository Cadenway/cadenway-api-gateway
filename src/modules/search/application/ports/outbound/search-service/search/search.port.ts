import type { SearchQuery } from '../../../../models/search/search-query.model.js';

/** Reads the currently authorized palette page from Search. */
export interface SearchPort {
  // #region Methods
  /** Returns the upstream page for the verified caller. */
  search(query: SearchQuery): Promise<object>;
  // #endregion
}
