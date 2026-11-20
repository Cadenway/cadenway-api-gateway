import type { TaskCollaborationRegistry } from '../../../../ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Relays get-onboarding to task-service. */
export class GetOnboarding {
  // #region Constructor
  /** Binds the task collaboration port. */
  public constructor(private readonly registry: TaskCollaborationRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(userId: string): Promise<{ body: object; version: number }> {
    return this.registry.getOnboarding(userId);
  }
  // #endregion
}
