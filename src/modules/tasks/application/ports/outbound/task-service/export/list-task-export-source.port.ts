import type { ListTaskExportFrame } from '../../../../models/export/list-task-export-frame.model.js';
import type { ListTaskExportQuery } from '../../../../models/export/list-task-export-query.model.js';

/** Reads the authorized CSV projection through Task's validated internal client. */
export interface ListTaskExportSource {
  // #region Methods
  /** Forwards all filters under the current verified actor and organization. */
  read(
    listId: string,
    query: ListTaskExportQuery,
    signal: AbortSignal,
  ): Promise<AsyncIterable<ListTaskExportFrame>>;
  // #endregion
}
