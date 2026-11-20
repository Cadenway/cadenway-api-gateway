/** Verified caller and filters of one Sprint report observation. */
export interface SprintReportCursorScope {
  // #region Properties
  /** Organization and account from the verified credential. */
  readonly organizationId: string;
  readonly userId: string;

  /** Sprint and calendar filters from the validated request. */
  readonly listId: string;
  readonly today: string;
  readonly timeZone: string;
  // #endregion
}
