import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/**
 * Class UpdateList
 *
 * @description
 * Changes a list. Forwards `PATCH /internal/v1/lists/{listId}` to task-service, which decides everything about it.
 */
export class UpdateList {
  // #region Properties
  /**
   * Property listRegistry
   *
   * @description
   * The lists and sprints of task-service.
   *
   * @type {ListRegistry}
   * @readonly
   */
  private readonly listRegistry: ListRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {ListRegistry} listRegistry - The lists and sprints of task-service.
   * @constructor
   */
  public constructor(listRegistry: ListRegistry) {
    this.listRegistry = listRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Changes a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    listId: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.listRegistry.updateList(listId, patch, ifMatch);
  }
  // #endregion
}
