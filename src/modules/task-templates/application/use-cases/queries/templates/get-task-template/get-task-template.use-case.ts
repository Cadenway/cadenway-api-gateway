import type { TaskTemplatesRegistry } from '../../../../ports/outbound/task-service/templates/task-templates-registry.port.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Relays getTaskTemplate to task-service. */
export class GetTaskTemplate {
  // #region Properties
  /** The task-service port. */
  private readonly registry: TaskTemplatesRegistry;
  // #endregion
  // #region Constructor
  /** Binds the task-service port. */
  public constructor(registry: TaskTemplatesRegistry) {
    this.registry = registry;
  }
  // #endregion
  // #region Methods
  /** Executes the operation. */
  public execute(spaceId: string, templateId: string): Promise<TaskServiceDocument> {
    return this.registry.getTaskTemplate(spaceId, templateId);
  }
  // #endregion
}
