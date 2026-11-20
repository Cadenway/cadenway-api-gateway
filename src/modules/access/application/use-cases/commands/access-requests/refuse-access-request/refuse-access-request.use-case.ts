import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { AccessRequestRegistry } from '../../../../ports/outbound/task-service/access-requests/access-request-registry.port.js';

/**
 * Class RefuseAccessRequest
 *
 * @description
 * Refuses an access request. Forwards `POST /internal/v1/access-requests/{accessRequestId}/refusal` to task-service, which decides everything about it.
 */
export class RefuseAccessRequest {
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
   * Refuses an access request.
   *
   * @param {string} accessRequestId - Id of the access request.
   * @param {TaskServiceDocument} refusal - The empty body the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The request, refused, as task-service answered it.
   */
  public execute(
    accessRequestId: string,
    refusal: TaskServiceDocument,
  ): Promise<TaskServiceDocument> {
    return this.accessRequestRegistry.refuseAccessRequest(accessRequestId, refusal);
  }
  // #endregion
}
