import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/**
 * Class DeleteList
 *
 * @description
 * Deletes a list or a sprint. Forwards `DELETE /internal/v1/lists/{listId}` to task-service, which
 * decides everything about it: who may delete it, its tasks and their way to the trash.
 */
export class DeleteList {
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
   * Deletes a list or a sprint.
   *
   * @param {string} listId - Id of the list.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<void>} Once task-service deleted the list.
   */
  public execute(listId: string, ifMatch: string | undefined): Promise<void> {
    return this.listRegistry.deleteList(listId, ifMatch);
  }
  // #endregion
}
