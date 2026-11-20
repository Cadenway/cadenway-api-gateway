import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the update-goal-result operation to task-service. */
export class UpdateGoalResult {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(
    goalId: string,
    resultId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }> {
    return this.registry.updateGoalResult(goalId, resultId, body, ifMatch);
  }
  // #endregion
}
