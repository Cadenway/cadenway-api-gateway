/** An export dependency failed before any part of the CSV could be served. */
export class ListTaskExportUnavailable extends Error {
  // #region Constructor
  /** Supplies only the service and stable upstream code needed by the HTTP problem mapper. */
  public constructor(
    public readonly service: 'task-service' | 'organization-service' | 'api-gateway',
    public readonly code: 'upstream.unavailable' | 'upstream.deadline-exceeded',
  ) {
    super('The complete list export is unavailable.');
    this.name = 'ListTaskExportUnavailable';
  }
  // #endregion
}
