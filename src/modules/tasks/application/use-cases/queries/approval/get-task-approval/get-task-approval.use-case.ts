import type { TaskCollaborationRegistry } from '../../../../ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Relays get-task-approval to task-service. */
export class GetTaskApproval {
  // #region Constructor
  /** Binds the task collaboration port. */
  public constructor(private readonly registry: TaskCollaborationRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(taskKey: string): Promise<{ body: object; version: number }> {
    return this.registry.getTaskApproval(taskKey);
  }
  // #endregion
}
