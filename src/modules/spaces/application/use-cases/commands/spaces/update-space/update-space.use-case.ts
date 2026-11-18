import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';

/**
 * Class UpdateSpace
 *
 * @description
 * Changes a space. Forwards `PATCH /internal/v1/spaces/{spaceId}` to task-service, which decides everything about it.
 */
export class UpdateSpace {
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
   * Changes a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    spaceId: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.spaceRegistry.updateSpace(spaceId, patch, ifMatch);
  }
  // #endregion
}
