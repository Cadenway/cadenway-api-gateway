/** The list and count could not be verified as a complete result. */
export class ReminderListUnavailable extends Error {
  // #region Constructor
  /** Supplies the stable upstream code and dependency for the public problem mapper. */
  public constructor(
    public readonly code: 'upstream.unavailable' | 'upstream.failed' | 'upstream.deadline-exceeded',
    public readonly service: 'notification-service' | 'task-service' | 'api-gateway',
  ) {
    super('The complete reminder list is unavailable.');
    this.name = 'ReminderListUnavailable';
  }
  // #endregion
}
