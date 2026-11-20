import type { TaskCollaborationRegistry } from '../../../../ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Relays vote-on-task-approval to task-service. */
export class VoteOnTaskApproval {
  // #region Constructor
  /** Binds the task collaboration port. */
  public constructor(private readonly registry: TaskCollaborationRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(
    taskKey: string,
    roundId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }> {
    return this.registry.voteOnTaskApproval(taskKey, roundId, body, ifMatch);
  }
  // #endregion
}
