import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays listTaskDependencies to task-service. */
export class ListTaskDependencies {
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
  public execute(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.registry.listTaskDependencies(taskKey, query);
  }
  // #endregion
}
