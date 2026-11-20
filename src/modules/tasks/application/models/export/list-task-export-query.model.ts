/** The validated query relayed to Task, with the two presentation settings read by the gateway. */
export interface ListTaskExportQuery {
  // #region Properties
  /** Optional Feuille sort passed through unchanged and used here only for assignee names. */
  readonly sheetSortColumn?: string;
  readonly sheetSortDirection?: 'asc' | 'desc';
  // #endregion
}
