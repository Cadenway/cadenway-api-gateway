/** The cursor is malformed or does not belong to the authenticated owner. */
export class InvalidReminderCursor extends Error {
  // #region Constructor
  /** Exposes a diagnostic without the submitted cursor. */
  public constructor() {
    super('The reminder cursor is invalid for this request.');
    this.name = 'InvalidReminderCursor';
  }
  // #endregion
}
