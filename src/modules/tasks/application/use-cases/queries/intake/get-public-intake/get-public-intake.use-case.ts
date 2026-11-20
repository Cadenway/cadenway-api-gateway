import type { IntakeRegistry } from '../../../../ports/outbound/task-service/intake/intake-registry.port.js';

/** Relays the intake operation to task-service. */
export class GetPublicIntake {
  // #region Constructor
  /** Binds the intake transport. */
  public constructor(private readonly registry: IntakeRegistry) {}
  // #endregion

  // #region Methods
  /** Executes the operation. */
  public execute(publicKey: string): Promise<object> {
    return this.registry.getPublic(publicKey);
  }
  // #endregion
}
