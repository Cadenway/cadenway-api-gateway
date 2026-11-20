import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { AccessRequestRegistry } from '../../../../ports/outbound/task-service/access-requests/access-request-registry.port.js';

/**
 * Class ListAccessRequests
 *
 * @description
 * Lists the pending access requests the actor may answer. Forwards `GET /internal/v1/access-requests` to task-service, which decides everything about it.
 */
export class ListAccessRequests {
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
   * Lists the pending access requests the actor may answer.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} One page of pending requests, as task-service answered it.
   */
  public execute(query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.accessRequestRegistry.listAccessRequests(query);
  }
  // #endregion
}
