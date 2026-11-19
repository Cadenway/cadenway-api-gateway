import type { VersionedGrant } from '../../../../models/grants/versioned-grant.model.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface GrantRegistry
 *
 * @description
 * Outgoing port of the grant routes: the grants of the spaces and lists of task-service, called
 * as the user of the current organization context, in the organization of its internal token.
 * task-service decides who reads and who changes a grant, and every rule of a grant; what the
 * actor does not see answers `404`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract (a change without a
 * strong `ETag` included).
 */
export interface GrantRegistry {
  // #region Methods
  /**
   * Method listSpaceGrants
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}/grants`. Lists the grants of a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listSpaceGrants(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method setSpaceGrant
   *
   * @description
   * `PUT /internal/v1/spaces/{spaceId}/grants/{userId}`. Gives or changes the role of a person on
   * a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string} userId - Account of the person.
   * @param {TaskServiceDocument} change - The role, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<VersionedGrant>} The grant and the version of the space.
   */
  setSpaceGrant(
    spaceId: string,
    userId: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<VersionedGrant>;

  /**
   * Method removeSpaceGrant
   *
   * @description
   * `DELETE /internal/v1/spaces/{spaceId}/grants/{userId}`. Removes the grant of a person on a
   * space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string} userId - Account of the person.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the space after the change.
   */
  removeSpaceGrant(spaceId: string, userId: string, ifMatch: string | undefined): Promise<number>;

  /**
   * Method listListGrants
   *
   * @description
   * `GET /internal/v1/lists/{listId}/grants`. Lists the grants of a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listListGrants(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method setListGrant
   *
   * @description
   * `PUT /internal/v1/lists/{listId}/grants/{userId}`. Gives or changes the role of a person on a
   * list.
   *
   * @param {string} listId - Id of the list.
   * @param {string} userId - Account of the person.
   * @param {TaskServiceDocument} change - The role, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<VersionedGrant>} The grant and the version of the list.
   */
  setListGrant(
    listId: string,
    userId: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<VersionedGrant>;

  /**
   * Method removeListGrant
   *
   * @description
   * `DELETE /internal/v1/lists/{listId}/grants/{userId}`. Removes the grant of a person on a list.
   *
   * @param {string} listId - Id of the list.
   * @param {string} userId - Account of the person.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the list after the change.
   */
  removeListGrant(listId: string, userId: string, ifMatch: string | undefined): Promise<number>;
  // #endregion
}
