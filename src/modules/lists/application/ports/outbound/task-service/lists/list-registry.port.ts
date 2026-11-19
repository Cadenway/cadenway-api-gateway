import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface ListRegistry
 *
 * @description
 * Outgoing port of the lists routes: the lists and sprints of task-service, called as the user of the current
 * organization context, in the organization of its internal token. task-service decides who sees
 * what and every rule; what the actor does not see answers `404`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface ListRegistry {
  // #region Methods
  /**
   * Method createList
   *
   * @description
   * `POST /internal/v1/spaces/{spaceId}/lists`. Creates a list or a sprint in a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  createList(
    spaceId: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method listLists
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}/lists`. Lists the lists of a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listLists(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method getList
   *
   * @description
   * `GET /internal/v1/lists/{listId}`. Reads a list the actor sees.
   *
   * @param {string} listId - Id of the list.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  getList(listId: string): Promise<TaskServiceDocument>;

  /**
   * Method updateList
   *
   * @description
   * `PATCH /internal/v1/lists/{listId}`. Changes a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  updateList(
    listId: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method deleteList
   *
   * @description
   * `DELETE /internal/v1/lists/{listId}`. Deletes a list, archived or not; task-service then moves
   * its tasks to the trash. `204` without `ETag`.
   *
   * @param {string} listId - Id of the list.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<void>} Once task-service deleted the list.
   */
  deleteList(listId: string, ifMatch: string | undefined): Promise<void>;

  /**
   * Method getListCounts
   *
   * @description
   * `GET /internal/v1/lists/{listId}/counts`. Counts the tasks of a list, on the `today` of the caller.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  getListCounts(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method listListActivity
   *
   * @description
   * `GET /internal/v1/lists/{listId}/activity`. Lists the activity of the tasks of a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listListActivity(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;
  // #endregion
}
