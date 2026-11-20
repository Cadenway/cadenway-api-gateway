import type { WatchersRegistry } from '../../../../ports/outbound/task-service/watchers/watchers-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { VersionedWatcher } from '../../../../models/watchers/versioned-watcher.model.js';

/** Relays followTaskWatcher to task-service. */
export class FollowTaskWatcher {
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
  public execute(
    taskKey: string,
    userId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<VersionedWatcher> {
    return this.registry.followTaskWatcher(taskKey, userId, body, ifMatch);
  }
  // #endregion
}
