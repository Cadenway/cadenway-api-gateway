import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { SpaceRegistry } from '../../../../ports/outbound/task-service/spaces/space-registry.port.js';

/** Relays listSpaceMilestones to task-service. */
export class ListSpaceMilestones {
  // #region Properties
  /** The task-service port. */
  private readonly registry: SpaceRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: SpaceRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.registry.listSpaceMilestones(spaceId, query);
  }
  // #endregion
}
