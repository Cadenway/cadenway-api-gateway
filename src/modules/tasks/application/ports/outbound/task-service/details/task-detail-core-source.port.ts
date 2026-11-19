import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface TaskDetailCoreSource
 *
 * @description
 * Outgoing port of the main part of the task detail: `GET /internal/v1/tasks/{taskKey}/detail` of
 * task-service, called as the user of the current organization context. Its failure is the failure
 * of the whole detail.
 *
 * It resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service (`404 task.not-found`, `404 task.trashed`
 * with its `details`, `404 organization.not-found`), or `503 upstream.*`.
 */
export interface TaskDetailCoreSource {
  // #region Methods
  /**
   * Method getTaskDetail
   *
   * @description
   * Reads the task, its space, its list, its parent and its direct subtasks.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskServiceDocument>} `TaskDetailCore` of task-service.
   */
  getTaskDetail(taskKey: string): Promise<TaskServiceDocument>;
  // #endregion
}
