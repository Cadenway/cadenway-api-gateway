import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface SpaceRegistry
 *
 * @description
 * Outgoing port of the spaces routes: the spaces of task-service, called as the user of the current
 * organization context, in the organization of its internal token. task-service decides who sees
 * what and every rule; what the actor does not see answers `404`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface SpaceRegistry {
  // #region Methods
  /**
   * Method listSpaces
   *
   * @description
   * `GET /internal/v1/spaces`. Lists the spaces the actor sees.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listSpaces(query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method createSpace
   *
   * @description
   * `POST /internal/v1/spaces`. Creates a space and its first list.
   *
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  createSpace(
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method getSpace
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}`. Reads a space the actor sees.
   *
   * @param {string} spaceId - Id of the space.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  getSpace(spaceId: string): Promise<TaskServiceDocument>;

  /**
   * Method updateSpace
   *
   * @description
   * `PATCH /internal/v1/spaces/{spaceId}`. Changes a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  updateSpace(
    spaceId: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method deleteSpace
   *
   * @description
   * `DELETE /internal/v1/spaces/{spaceId}`. Deletes a space with its lists; task-service then moves
   * its tasks to the trash. `204` without `ETag`.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<void>} Once task-service deleted the space.
   */
  deleteSpace(spaceId: string, ifMatch: string | undefined): Promise<void>;

  /**
   * Method getSpaceOverview
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}/overview`. Reads the overview of a space, counted on the `today` of the caller.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  getSpaceOverview(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;
  // #endregion
}
