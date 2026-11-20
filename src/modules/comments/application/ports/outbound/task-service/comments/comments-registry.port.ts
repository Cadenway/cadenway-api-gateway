import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Task-service operations owned by the comments capability. */
export interface CommentsRegistry {
  // #region Methods
  /** Relays listTaskComments to task-service. */
  listTaskComments(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /** Relays createTaskComment to task-service. */
  createTaskComment(
    taskKey: string,
    body: TaskServiceDocument,
    key: string | undefined,
  ): Promise<TaskServiceDocument>;

  /** Relays getTaskComment to task-service. */
  getTaskComment(taskKey: string, commentId: string): Promise<TaskServiceDocument>;

  /** Relays updateTaskComment to task-service. */
  updateTaskComment(
    taskKey: string,
    commentId: string,
    body: TaskServiceDocument,
    ifMatch: string,
  ): Promise<TaskServiceDocument>;

  /** Relays deleteTaskComment to task-service. */
  deleteTaskComment(taskKey: string, commentId: string, ifMatch: string | undefined): Promise<void>;

  /** Relays listTaskParticipants to task-service. */
  listTaskParticipants(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;
  // #endregion
}
