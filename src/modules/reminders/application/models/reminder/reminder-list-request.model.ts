/** The validated public query and its authenticated owner scope. */
export interface ReminderListRequest {
  // #region Properties
  /** The verified organization, which owns this collection. */
  readonly organizationId: string;

  /** The verified account, which owns the reminders. */
  readonly userId: string;

  /** An opaque position from this owner's previous page, when supplied. */
  readonly cursor?: string;

  /** The requested page size, at most 100. Defaults to 50. */
  readonly limit?: number;
  // #endregion
}
