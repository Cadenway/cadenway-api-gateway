/** Signed owner scope of a personal reminder cursor. */
export interface ReminderCursorScope {
  // #region Properties
  /** Organization in the verified credential. */
  readonly organizationId: string;

  /** Account in the verified credential. */
  readonly userId: string;
  // #endregion
}
