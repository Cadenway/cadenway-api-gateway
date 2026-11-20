import type { GoalRegistry } from '../../../../ports/outbound/task-service/goal/goal-registry.port.js';

/** Relays the list-goals operation to task-service. */
export class ListGoals {
  // #region Constructor
  /** Binds the goal transport. */
  public constructor(private readonly registry: GoalRegistry) {}
  // #endregion

  // #region Methods
  /** Forwards the verified request. */
  public execute(query: object): Promise<object> {
    return this.registry.listGoals(query);
  }
  // #endregion
}
