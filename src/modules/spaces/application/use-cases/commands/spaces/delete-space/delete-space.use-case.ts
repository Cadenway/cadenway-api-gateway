import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';

/**
 * Class DeleteSpace
 *
 * @description
 * Deletes a space. Forwards `DELETE /internal/v1/spaces/{spaceId}` to task-service, which decides
 * everything about it: who manages the space, its lists and tasks, and their way to the trash.
 */
export class DeleteSpace {
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
   * Deletes a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<void>} Once task-service deleted the space.
   */
  public execute(spaceId: string, ifMatch: string | undefined): Promise<void> {
    return this.spaceRegistry.deleteSpace(spaceId, ifMatch);
  }
  // #endregion
}
