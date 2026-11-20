import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the create-goal-result operation to task-service. */
export class CreateGoalResult {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(
    goalId: string,
    body: object,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<{ body: object; version: number }> {
    return this.registry.createGoalResult(goalId, body, ifMatch, key);
  }
  // #endregion
}
