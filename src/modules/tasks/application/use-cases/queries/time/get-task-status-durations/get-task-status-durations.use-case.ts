import type { TaskTimeRegistry } from '../../../../ports/outbound/task-service/time/task-time-registry.port.js';

/** Relays get-task-status-durations to task-service. */
export class GetTaskStatusDurations {
  // #region Constructor
  /** Binds the task time port. */
  public constructor(private readonly registry: TaskTimeRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(taskKey: string): Promise<object> {
    return this.registry.durations(taskKey);
  }
  // #endregion
}
