import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface AccessRequestRegistry
 *
 * @description
 * Outgoing port of the access request routes: the access requests of task-service, called as the
 * user of the current organization context, in the organization of its internal token.
 * task-service decides whether a request is stored, who may answer it and the grant an approval
 * gives; a request the actor may not answer answers `404`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface AccessRequestRegistry {
  // #region Methods
  /**
   * Method createAccessRequest
   *
   * @description
   * `POST /internal/v1/access-requests`. Asks for access to a space, a list or a task; task-service
   * answers `202` whether it stored the request or not.
   *
   * @param {TaskServiceDocument} creation - The target and the message the public validator
   * accepted.
   * @returns {Promise<void>} Once task-service took the request.
   */
  createAccessRequest(creation: TaskServiceDocument): Promise<void>;

  /**
   * Method listAccessRequests
   *
   * @description
   * `GET /internal/v1/access-requests`. Lists the pending requests the actor may answer.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listAccessRequests(query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method approveAccessRequest
   *
   * @description
   * `POST /internal/v1/access-requests/{accessRequestId}/approval`. Approves a request with a role.
   *
   * @param {string} accessRequestId - Id of the access request.
   * @param {TaskServiceDocument} approval - The role to give, as the public validator accepted it.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  approveAccessRequest(
    accessRequestId: string,
    approval: TaskServiceDocument,
  ): Promise<TaskServiceDocument>;

  /**
   * Method refuseAccessRequest
   *
   * @description
   * `POST /internal/v1/access-requests/{accessRequestId}/refusal`. Refuses a request.
   *
   * @param {string} accessRequestId - Id of the access request.
   * @param {TaskServiceDocument} refusal - The empty body the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  refuseAccessRequest(
    accessRequestId: string,
    refusal: TaskServiceDocument,
  ): Promise<TaskServiceDocument>;
  // #endregion
}
