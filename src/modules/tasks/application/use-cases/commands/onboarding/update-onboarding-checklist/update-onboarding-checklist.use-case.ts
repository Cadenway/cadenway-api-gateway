import type { TaskCollaborationRegistry } from '../../../../ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Relays update-onboarding-checklist to task-service. */
export class UpdateOnboardingChecklist {
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
    return this.registry.updateOnboardingChecklist(userId, body, ifMatch);
  }
  // #endregion
}
