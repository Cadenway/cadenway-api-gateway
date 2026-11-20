/** Encoded cells and assignees in the order Task selected for an export row. */
export interface ListTaskExportRow {
  // #region Properties
  /** The encoded cells before the assignees column. */
  readonly beforeAssignees: readonly string[];

  /** Accounts in assignment order, for the directory lookup. */
  readonly assigneeIds: readonly string[];

  /** The encoded cells after the assignees column. */
  readonly afterAssignees: readonly string[];
  // #endregion
}
