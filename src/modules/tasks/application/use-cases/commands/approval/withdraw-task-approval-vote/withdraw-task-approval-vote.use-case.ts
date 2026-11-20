import type { TaskCollaborationRegistry } from '../../../../ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Relays withdraw-task-approval-vote to task-service. */
export class WithdrawTaskApprovalVote {
  // #region Constructor
  /** Binds the task collaboration port. */
  public constructor(private readonly registry: TaskCollaborationRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(
    taskKey: string,
    roundId: string,
    ifMatch: string | undefined,
  ): Promise<{ version: number }> {
    return this.registry.withdrawTaskApprovalVote(taskKey, roundId, ifMatch);
  }
  // #endregion
}
