import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the get-goal operation to task-service. */
export class GetGoal {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(goalId: string, today: string): Promise<{ body: object; version: number }> {
    return this.registry.getGoal(goalId, today);
  }
  // #endregion
}
