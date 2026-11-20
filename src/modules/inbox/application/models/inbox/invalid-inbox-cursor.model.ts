/** The continuation is invalid for this query and verified owner. */
export class InvalidInboxCursor extends Error {
  // #region Constructor
  /** Exposes a stable diagnostic without including the submitted cursor. */
  public constructor() {
    super('The inbox cursor is invalid for this request.');
    this.name = 'InvalidInboxCursor';
  }
  // #endregion
}
