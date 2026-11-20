import type { ListTaskCsvSpool } from './list-task-csv-spool.port.js';

/** Allocates the application a bounded private spool for one export at a time. */
export interface ListTaskCsvSpoolFactory {
  // #region Methods
  /** Opens a new private file or returns null when capacity is already occupied. */
  open(): Promise<ListTaskCsvSpool | null>;
  // #endregion
}
