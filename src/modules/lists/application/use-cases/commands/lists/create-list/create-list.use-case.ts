import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { ListRegistry } from '../../../../ports/outbound/task-service/lists/list-registry.port.js';

/**
 * Class CreateList
 *
 * @description
 * Creates a list or a sprint in a space. Forwards `POST /internal/v1/spaces/{spaceId}/lists` to task-service, which decides everything about it.
 */
export class CreateList {
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
   * Creates a list or a sprint in a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    spaceId: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.listRegistry.createList(spaceId, creation, idempotencyKey);
  }
  // #endregion
}
