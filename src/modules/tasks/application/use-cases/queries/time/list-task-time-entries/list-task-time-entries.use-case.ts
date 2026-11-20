import type { TaskTimeRegistry } from '../../../../ports/outbound/task-service/time/task-time-registry.port.js';

/** Relays list-task-time-entries to task-service. */
export class ListTaskTimeEntries {
  // #region Constructor
  /** Binds the task time port. */
  public constructor(private readonly registry: TaskTimeRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(taskKey: string, query: object): Promise<object> {
    return this.registry.list(taskKey, query);
  }
  // #endregion
}
