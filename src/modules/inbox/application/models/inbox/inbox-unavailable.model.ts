/** A complete authorized inbox result could not be assembled. */
export class InboxUnavailable extends Error {
  // #region Constructor
  /** Carries only stable error metadata for the public problem mapper. */
  public constructor(
    public readonly service: 'task-service' | 'notification-service' | 'api-gateway',
    public readonly code: 'upstream.failed' | 'upstream.deadline-exceeded' = 'upstream.failed',
  ) {
    super('The complete inbox response is unavailable.');
    this.name = 'InboxUnavailable';
  }
  // #endregion
}
