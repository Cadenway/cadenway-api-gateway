import type { CommentsRegistry } from '../../../../ports/outbound/task-service/comments/comments-registry.port.js';

/** Relays deleteTaskComment to the owning service. */
export class DeleteTaskComment {
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
  public execute(taskKey: string, commentId: string, ifMatch: string | undefined): Promise<void> {
    return this.registry.deleteTaskComment(taskKey, commentId, ifMatch);
  }
  // #endregion
}
