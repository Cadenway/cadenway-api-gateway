import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the get-goal-result operation to task-service. */
export class GetGoalResult {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(goalId: string, resultId: string): Promise<{ body: object; version: number }> {
    return this.registry.getGoalResult(goalId, resultId);
  }
  // #endregion
}
