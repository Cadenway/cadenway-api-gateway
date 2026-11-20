import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { VersionedDependency } from '../../../../models/dependencies/versioned-dependency.model.js';

/** Dependency operations provided by task-service. */
export interface DependenciesRegistry {
  // #region Methods
  /** Relays listTaskDependencies to task-service. */
  listTaskDependencies(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /** Relays createTaskDependency to task-service. */
  createTaskDependency(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<VersionedDependency>;

  /** Relays getTaskDependency to task-service. */
  getTaskDependency(taskKey: string, dependencyId: string): Promise<TaskServiceDocument>;

  /** Relays deleteTaskDependency to task-service. */
  deleteTaskDependency(
    taskKey: string,
    dependencyId: string,
    ifMatch: string | undefined,
  ): Promise<number>;

  /** Relays listDependencyCandidates to task-service. */
  listDependencyCandidates(
    taskKey: string,
    query: TaskServiceDocument,
  ): Promise<TaskServiceDocument>;
  // #endregion
}
