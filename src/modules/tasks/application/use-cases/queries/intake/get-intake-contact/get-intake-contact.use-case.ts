import type { IntakeRegistry } from '../../../../ports/outbound/task-service/intake/intake-registry.port.js';

/** Relays the intake operation to task-service. */
export class GetIntakeContact {
  // #region Constructor
  /** Binds the intake transport. */
  public constructor(private readonly registry: IntakeRegistry) {}
  // #endregion

  // #region Methods
  /** Executes the operation. */
  public execute(taskKey: string): Promise<object> {
    return this.registry.contact(taskKey);
  }
  // #endregion
}
