import type { ListTaskCsvSpool } from './list-task-csv-spool.port.js';

/** Allocates a bounded private spool for an organization. */
export interface ListTaskCsvSpoolFactory {
  // #region Methods
  /** Opens a private file while capacity is available, with at most one per organization. */
  open(organizationId: string): Promise<ListTaskCsvSpool | null>;
  // #endregion
}
