import type { IntakeRegistry } from '../../../../ports/outbound/task-service/intake/intake-registry.port.js';

/** Relays the intake operation to task-service. */
export class DisableIntake {
  // #region Constructor
  /** Binds the intake transport. */
  public constructor(private readonly registry: IntakeRegistry) {}
  // #endregion

  // #region Methods
  /** Executes the operation. */
  public execute(listId: string, ifMatch: string | undefined): Promise<{ version: number }> {
    return this.registry.disable(listId, ifMatch);
  }
  // #endregion
}
