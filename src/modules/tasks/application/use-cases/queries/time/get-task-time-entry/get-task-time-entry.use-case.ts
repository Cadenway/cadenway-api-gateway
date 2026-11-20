import type { TaskTimeRegistry } from '../../../../ports/outbound/task-service/time/task-time-registry.port.js';

/** Relays get-task-time-entry to task-service. */
export class GetTaskTimeEntry {
  // #region Constructor
  /** Binds the task time port. */
  public constructor(private readonly registry: TaskTimeRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(taskKey: string, entryId: string): Promise<object> {
    return this.registry.get(taskKey, entryId);
  }
  // #endregion
}
