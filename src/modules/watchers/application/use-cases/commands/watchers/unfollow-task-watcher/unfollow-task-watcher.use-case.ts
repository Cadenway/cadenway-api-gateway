import type { WatchersRegistry } from '../../../../ports/outbound/task-service/watchers/watchers-registry.port.js';

/** Relays unfollowTaskWatcher to task-service. */
export class UnfollowTaskWatcher {
  // #region Properties
  /** The task-service port. */
  private readonly registry: WatchersRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: WatchersRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(taskKey: string, userId: string, ifMatch: string | undefined): Promise<number> {
    return this.registry.unfollowTaskWatcher(taskKey, userId, ifMatch);
  }
  // #endregion
}
