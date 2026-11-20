/** Protects one sprint cursor in the verified caller's reporting scope. */
export interface ReportCursor {
  // #region Methods
  /** Seals or opens the cursor for a single list and calendar request. */
  execute(
    action: 'seal' | 'open',
    cursor: string,
    scope: {
      readonly organizationId: string;
      readonly userId: string;
      readonly listId: string;
      readonly today: string;
      readonly timeZone: string;
    },
  ): string | null;
  // #endregion
}
