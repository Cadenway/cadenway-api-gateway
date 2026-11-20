import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Task template operations provided by task-service. */
export interface TaskTemplatesRegistry {
  // #region Methods
  /** Relays listTaskTemplates to task-service. */
  listTaskTemplates(spaceId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /** Relays createTaskTemplate to task-service. */
  createTaskTemplate(
    spaceId: string,
    body: TaskServiceDocument,
    key: string | undefined,
  ): Promise<TaskServiceDocument>;

  /** Relays getTaskTemplate to task-service. */
  getTaskTemplate(spaceId: string, templateId: string): Promise<TaskServiceDocument>;

  /** Relays deleteTaskTemplate to task-service. */
  deleteTaskTemplate(
    spaceId: string,
    templateId: string,
    ifMatch: string | undefined,
  ): Promise<void>;
  // #endregion
}
