import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { VersionedWatcher } from '../../../../models/watchers/versioned-watcher.model.js';

/** Watcher operations provided by task-service. */
export interface WatchersRegistry {
  // #region Methods
  /** Relays listTaskWatchers to task-service. */
  listTaskWatchers(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /** Relays followTaskWatcher to task-service. */
  followTaskWatcher(
    taskKey: string,
    userId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<VersionedWatcher>;

  /** Relays unfollowTaskWatcher to task-service. */
  unfollowTaskWatcher(
    taskKey: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<number>;
  // #endregion
}
