import type { TaskServiceDocument } from '../task-service/task-service-document.model.js';
/** A watcher and its task version. */
export interface VersionedWatcher {
  // #region Properties
  /** Watcher returned by task-service. */
  readonly watcher: TaskServiceDocument;

  /** Task version from the upstream ETag. */
  readonly version: number;
  // #endregion
}
