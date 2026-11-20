import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the delete-goal-result operation to task-service. */
export class DeleteGoalResult {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(goalId: string, resultId: string, ifMatch: string | undefined): Promise<void> {
    return this.registry.deleteGoalResult(goalId, resultId, ifMatch);
  }
  // #endregion
}
