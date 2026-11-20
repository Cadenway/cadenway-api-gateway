import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays getTaskComment to the owning service. */
export class GetTaskComment {
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
  public execute(taskKey: string, commentId: string): Promise<TaskServiceDocument> {
    return this.registry.getTaskComment(taskKey, commentId);
  }
  // #endregion
}
