import type { TaskTimeRegistry } from '../../../../ports/outbound/task-service/time/task-time-registry.port.js';

/** Relays create-task-time-entry to task-service. */
export class CreateTaskTimeEntry {
  // #region Constructor
  /** Binds the task time port. */
  public constructor(private readonly registry: TaskTimeRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(taskKey: string, body: object, key: string | undefined): Promise<object> {
    return this.registry.create(taskKey, body, key);
  }
  // #endregion
}
