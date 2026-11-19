import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { AccessRequestRegistry } from '../../../../ports/outbound/task-service/access-requests/access-request-registry.port.js';

/**
 * Class CreateAccessRequest
 *
 * @description
 * Asks for access to a space, a list or a task. Forwards `POST /internal/v1/access-requests` to task-service, which decides everything about it.
 */
export class CreateAccessRequest {
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
   * Asks for access to a space, a list or a task.
   *
   * @param {TaskServiceDocument} creation - The target and the message the public validator accepted.
   * @returns {Promise<void>} Once task-service took the request, stored or not.
   */
  public execute(creation: TaskServiceDocument): Promise<void> {
    return this.accessRequestRegistry.createAccessRequest(creation);
  }
  // #endregion
}
