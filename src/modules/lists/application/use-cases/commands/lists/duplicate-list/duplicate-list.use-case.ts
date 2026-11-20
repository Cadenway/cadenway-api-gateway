import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/** Relays duplicateList to task-service. */
export class DuplicateList {
  // #region Properties
  /** The task-service port. */
  private readonly registry: ListRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: ListRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(
    listId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.registry.duplicateList(listId, body, ifMatch, key);
  }
  // #endregion
}
