import type { ListTaskCsv } from '../../../../models/export/list-task-csv.model.js';

/** Private preparation of one CSV document, with no public delivery until it is complete. */
export interface ListTaskCsvSpool {
  // #region Methods
  /** Writes the complete header, including its CRLF. */
  writeHeader(line: string): Promise<void>;

  /** Appends one complete row, including its CRLF, to the spool. */
  writeRow(line: string): Promise<void>;

  /** Opens the prepared file, optionally reordering rows by their original zero-based positions. */
  finish(filename: string, order?: readonly number[]): ListTaskCsv;

  /** Releases the file and the occupied slot when preparation fails. */
  dispose(): Promise<void>;
  // #endregion
}
