import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the create-goal operation to task-service. */
export class CreateGoal {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(
    today: string,
    body: object,
    key: string | undefined,
  ): Promise<{ body: object; version: number }> {
    return this.registry.createGoal(today, body, key);
  }
  // #endregion
}
