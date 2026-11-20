import type { WatchersRegistry } from '../../../../ports/outbound/task-service/watchers/watchers-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays listTaskWatchers to task-service. */
export class ListTaskWatchers {
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
  public execute(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.registry.listTaskWatchers(taskKey, query);
  }
  // #endregion
}
