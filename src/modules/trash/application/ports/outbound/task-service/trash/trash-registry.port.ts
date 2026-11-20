import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface TrashRegistry
 *
 * @description
 * Outgoing port of the trash routes: the trash of task-service, called as the user of the current
 * organization context, in the organization of its internal token. task-service decides who may
 * delete, restore and erase what, and every rule of the trash; an entry the actor may not restore
 * answers `404 trash-entry.not-found`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface TrashRegistry {
  // #region Methods
  /**
   * Method trashTask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/trash`. Moves a task and its subtasks at every level to the
   * trash as one entry. Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The trash entry.
   */
  trashTask(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method listTrash
   *
   * @description
   * `GET /internal/v1/trash/entries`. Lists the entries the actor may restore.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} One page of trash entries.
   */
  listTrash(query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method restoreTrashEntry
   *
   * @description
   * `POST /internal/v1/trash/entries/{entryId}/restore`. Brings an entry back to its list. Never
   * retried.
   *
   * @param {string} entryId - Id of the entry.
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The root of the entry and what came back with it.
   */
  restoreTrashEntry(
    entryId: string,
    body: TaskServiceDocument,
    query: TaskServiceDocument,
  ): Promise<TaskServiceDocument>;

  /**
   * Method purgeTrashEntry
   *
   * @description
   * `DELETE /internal/v1/trash/entries/{entryId}`. Erases an entry for good.
   *
   * @param {string} entryId - Id of the entry.
   * @returns {Promise<void>} Once the entry is erased.
   */
  purgeTrashEntry(entryId: string): Promise<void>;

  /**
   * Method emptyTrash
   *
   * @description
   * `POST /internal/v1/trash/empty`. Takes every entry the actor may restore out of the trash, for
   * a job to erase. Never retried.
   *
   * @param {TaskServiceDocument} body - The empty body the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The count of the entries taken out.
   */
  emptyTrash(body: TaskServiceDocument): Promise<TaskServiceDocument>;
  // #endregion
}
