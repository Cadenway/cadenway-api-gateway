import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { VersionedDependency } from '../../../../models/dependencies/versioned-dependency.model.js';

/** Relays createTaskDependency to task-service. */
export class CreateTaskDependency {
  // #region Properties
  /** The task-service port. */
  private readonly registry: DependenciesRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: DependenciesRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<VersionedDependency> {
    return this.registry.createTaskDependency(taskKey, body, ifMatch, key);
  }
  // #endregion
}
