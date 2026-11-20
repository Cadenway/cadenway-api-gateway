import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/** Relays an atomic bulk action to task-service. */
export class ExecuteBulkTaskAction {
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
  /** Sends the accepted action and idempotency key. */
  public execute(body: TaskServiceDocument, key: string | undefined): Promise<TaskServiceDocument> {
    return this.registry.executeBulkTaskAction(body, key);
  }
  // #endregion
}
