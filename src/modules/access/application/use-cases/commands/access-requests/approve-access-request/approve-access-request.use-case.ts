import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { AccessRequestRegistry } from '../../../../ports/outbound/task-service/access-requests/access-request-registry.port.js';

/**
 * Class ApproveAccessRequest
 *
 * @description
 * Approves an access request with a role. Forwards `POST /internal/v1/access-requests/{accessRequestId}/approval` to task-service, which decides everything about it.
 */
export class ApproveAccessRequest {
  // #region Properties
  /**
   * Property accessRequestRegistry
   *
   * @description
   * The access requests of task-service.
   *
   * @type {AccessRequestRegistry}
   * @readonly
   */
  private readonly accessRequestRegistry: AccessRequestRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {AccessRequestRegistry} accessRequestRegistry - The access requests of task-service.
   * @constructor
   */
  public constructor(accessRequestRegistry: AccessRequestRegistry) {
    this.accessRequestRegistry = accessRequestRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Approves an access request with a role.
   *
   * @param {string} accessRequestId - Id of the access request.
   * @param {TaskServiceDocument} approval - The role to give, as the public validator accepted it.
   * @returns {Promise<TaskServiceDocument>} The request, approved, as task-service answered it.
   */
  public execute(
    accessRequestId: string,
    approval: TaskServiceDocument,
  ): Promise<TaskServiceDocument> {
    return this.accessRequestRegistry.approveAccessRequest(accessRequestId, approval);
  }
  // #endregion
}
