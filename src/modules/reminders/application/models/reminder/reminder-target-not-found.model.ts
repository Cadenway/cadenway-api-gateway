/** Hidden resources share the appropriate public not-found response. */
export class ReminderTargetNotFound extends Error {
  // #region Constructor
  /** Records the public resource code. */
  public constructor(public readonly code: 'task.not-found' | 'reminder.not-found') {
    super(code);
  }
  // #endregion
}
