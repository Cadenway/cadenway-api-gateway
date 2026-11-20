import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays createTaskComment to the owning service. */
export class CreateTaskComment {
  // #region Properties
  /** The task-service port. */
  private readonly registry: CommentsRegistry;
  // #endregion

  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: CommentsRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /** Executes the operation. */
  public execute(
    taskKey: string,
    body: TaskServiceDocument,
    key: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.registry.createTaskComment(taskKey, body, key);
  }
  // #endregion
}
