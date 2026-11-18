import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';

/**
 * Class GetSpaceOverview
 *
 * @description
 * Reads the overview of a space, counted on the `today` of the caller. Forwards `GET /internal/v1/spaces/{spaceId}/overview` to task-service, which decides everything about it.
 */
export class GetSpaceOverview {
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
   * Reads the overview of a space, counted on the `today` of the caller.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.spaceRegistry.getSpaceOverview(spaceId, query);
  }
  // #endregion
}
