import type { TaskServiceDocument } from '../task-service/task-service-document.model.js';
/** A dependency and its anchor task version. */
export interface VersionedDependency {
  // #region Properties
  /** Dependency returned by task-service. */
  readonly dependency: TaskServiceDocument;

  /** Anchor version from the upstream ETag. */
  readonly version: number;
  // #endregion
}
