import type { TaskCollaborationRegistry } from '../../../../ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Relays update-onboarding to task-service. */
export class UpdateOnboarding {
  // #region Constructor
  /** Binds the task collaboration port. */
  public constructor(private readonly registry: TaskCollaborationRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(
    userId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }> {
    return this.registry.updateOnboarding(userId, body, ifMatch);
  }
  // #endregion
}
