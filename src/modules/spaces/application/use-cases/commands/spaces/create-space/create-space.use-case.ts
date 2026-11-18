import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';

/**
 * Class CreateSpace
 *
 * @description
 * Creates a space and its first list. Forwards `POST /internal/v1/spaces` to task-service, which decides everything about it.
 */
export class CreateSpace {
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
   * Creates a space and its first list.
   *
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument> {
    return this.spaceRegistry.createSpace(creation, idempotencyKey);
  }
  // #endregion
}
