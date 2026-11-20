import type { IntakeRegistry } from '../../../../ports/outbound/task-service/intake/intake-registry.port.js';

/** Relays the intake operation to task-service. */
export class PublishIntake {
  // #region Constructor
  /** Binds the intake transport. */
  public constructor(private readonly registry: IntakeRegistry) {}
  // #endregion

  // #region Methods
  /** Executes the operation. */
  public execute(
    listId: string,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }> {
    return this.registry.publish(listId, ifMatch);
  }
  // #endregion
}
