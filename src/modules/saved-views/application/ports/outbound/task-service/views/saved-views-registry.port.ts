import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/** Saved view operations provided by task-service. */
export interface SavedViewsRegistry {
  // #region Methods
  /** Relays listSavedViews to task-service. */
  listSavedViews(listId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /** Relays createSavedView to task-service. */
  createSavedView(
    listId: string,
    body: TaskServiceDocument,
    key: string | undefined,
  ): Promise<TaskServiceDocument>;

  /** Relays getSavedView to task-service. */
  getSavedView(listId: string, viewId: string): Promise<TaskServiceDocument>;

  /** Relays updateSavedView to task-service. */
  updateSavedView(
    listId: string,
    viewId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /** Relays deleteSavedView to task-service. */
  deleteSavedView(listId: string, viewId: string, ifMatch: string | undefined): Promise<void>;

  /** Relays duplicateSavedView to task-service. */
  duplicateSavedView(
    listId: string,
    viewId: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<TaskServiceDocument>;
  // #endregion
}
