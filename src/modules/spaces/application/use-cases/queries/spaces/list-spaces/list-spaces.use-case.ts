import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';

/**
 * Class ListSpaces
 *
 * @description
 * Lists the spaces the actor sees. Forwards `GET /internal/v1/spaces` to task-service, which decides everything about it.
 */
export class ListSpaces {
  // #region Properties
  /**
   * Property spaceRegistry
   *
   * @description
   * The spaces of task-service.
   *
   * @type {SpaceRegistry}
   * @readonly
   */
  private readonly spaceRegistry: SpaceRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {SpaceRegistry} spaceRegistry - The spaces of task-service.
   * @constructor
   */
  public constructor(spaceRegistry: SpaceRegistry) {
    this.spaceRegistry = spaceRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Lists the spaces the actor sees.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.spaceRegistry.listSpaces(query);
  }
  // #endregion
}
