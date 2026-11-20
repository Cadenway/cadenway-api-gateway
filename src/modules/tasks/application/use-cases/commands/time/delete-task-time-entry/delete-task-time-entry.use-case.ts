import type { TaskTimeRegistry } from '../../../../ports/outbound/task-service/time/task-time-registry.port.js';

/** Relays delete-task-time-entry to task-service. */
export class DeleteTaskTimeEntry {
  // #region Constructor
  /** Binds the task time port. */
  public constructor(private readonly registry: TaskTimeRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(taskKey: string, entryId: string): Promise<void> {
    return this.registry.remove(taskKey, entryId);
  }
  // #endregion
}
