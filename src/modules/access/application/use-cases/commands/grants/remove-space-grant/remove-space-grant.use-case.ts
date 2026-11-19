import type { GrantRegistry } from '../../../../ports/outbound/task-service/grants/grant-registry.port.js';

/**
 * Class RemoveSpaceGrant
 *
 * @description
 * Removes the grant of a person on a space. Forwards `DELETE /internal/v1/spaces/{spaceId}/grants/{userId}` to task-service, which decides everything about it.
 */
export class RemoveSpaceGrant {
  // #region Properties
  /**
   * Property grantRegistry
   *
   * @description
   * The grants of the spaces and lists of task-service.
   *
   * @type {GrantRegistry}
   * @readonly
   */
  private readonly grantRegistry: GrantRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {GrantRegistry} grantRegistry - The grants of the spaces and lists of task-service.
   * @constructor
   */
  public constructor(grantRegistry: GrantRegistry) {
    this.grantRegistry = grantRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Removes the grant of a person on a space.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string} userId - Account of the person.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the space after the change.
   */
  public execute(spaceId: string, userId: string, ifMatch: string | undefined): Promise<number> {
    return this.grantRegistry.removeSpaceGrant(spaceId, userId, ifMatch);
  }
  // #endregion
}
