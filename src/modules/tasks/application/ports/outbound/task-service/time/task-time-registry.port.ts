/** Validated transport for the task time routes. */
export interface TaskTimeRegistry {
  // #region Methods
  /** Lists entries and totals for a task. */
  list(taskKey: string, query: object): Promise<object>;

  /** Creates a time entry with the caller's idempotency key. */
  create(taskKey: string, body: object, key: string | undefined): Promise<object>;

  /** Reads a particular entry. */
  get(taskKey: string, entryId: string): Promise<object>;

  /** Removes an entry. */
  remove(taskKey: string, entryId: string): Promise<void>;

  /** Reads the total and estimate. */
  summary(taskKey: string): Promise<object>;

  /** Reads the status duration summary. */
  durations(taskKey: string): Promise<object>;
  // #endregion
}
