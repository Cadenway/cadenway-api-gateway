import type { TaskTemplatesRegistry } from '../../../../ports/outbound/task-service/templates/task-templates-registry.port.js';

/** Relays deleteTaskTemplate to task-service. */
export class DeleteTaskTemplate {
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
  public execute(spaceId: string, templateId: string, ifMatch: string | undefined): Promise<void> {
    return this.registry.deleteTaskTemplate(spaceId, templateId, ifMatch);
  }
  // #endregion
}
