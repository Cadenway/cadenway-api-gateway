import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface ArchiveRegistry
 *
 * @description
 * Outgoing port of the archives routes: the archived lists and tasks of task-service, called as
 * the user of the current organization context, in the organization of its internal token.
 * task-service decides who may archive and restore (`edit` on the list), what an archive takes
 * with it and every other rule; what the actor does not see answers `404`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface ArchiveRegistry {
  // #region Methods
  /**
   * Method archiveList
   *
   * @description
   * `POST /internal/v1/lists/{listId}/archive`. Archives a list or a sprint; its tasks stay as
   * they are.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service: the list, archived.
   */
  archiveList(
    listId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method unarchiveList
   *
   * @description
   * `POST /internal/v1/lists/{listId}/unarchive`. Restores an archived list at the end of its
   * space.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service: the list, back in its space.
   */
  unarchiveList(
    listId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method archiveTask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/archive`. Archives a task and its subtasks at every level.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service: the task, archived.
   */
  archiveTask(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method unarchiveTask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/unarchive`. Restores the archive a task belongs to, from
   * its root.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service: the root of the archive.
   */
  unarchiveTask(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method listArchivedLists
   *
   * @description
   * `GET /internal/v1/archives/lists`. Lists the archived lists and sprints the actor sees.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listArchivedLists(query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method listArchivedTasks
   *
   * @description
   * `GET /internal/v1/archives/tasks`. Lists the roots of the archived subtrees the actor sees.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listArchivedTasks(query: TaskServiceDocument): Promise<TaskServiceDocument>;
  // #endregion
}
