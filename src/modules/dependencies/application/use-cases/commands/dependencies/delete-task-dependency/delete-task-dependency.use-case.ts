import type { DependenciesRegistry } from '../../../../ports/outbound/task-service/dependencies/dependencies-registry.port.js';

/** Relays deleteTaskDependency to task-service. */
export class DeleteTaskDependency {
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
    dependencyId: string,
    ifMatch: string | undefined,
  ): Promise<number> {
    return this.registry.deleteTaskDependency(taskKey, dependencyId, ifMatch);
  }
  // #endregion
}
