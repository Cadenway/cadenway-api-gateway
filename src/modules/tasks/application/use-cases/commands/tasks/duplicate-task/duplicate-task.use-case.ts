import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/** Relays duplicateTask to task-service. */
export class DuplicateTask {
  // #region Properties
  /** The task-service port. */
  private readonly registry: TaskRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: TaskRegistry) {
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
  ): Promise<TaskServiceDocument> {
    return this.registry.duplicateTask(taskKey, body, ifMatch, key);
  }
  // #endregion
}
