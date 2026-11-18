import type { TaskServiceDocument } from '../task-service/task-service-document.model.js';

/**
 * Interface AddedChecklistItem
 *
 * @description
 * What adding a checklist item answers: the task, and the id of the item task-service named in
 * its `Location`, from which the public `Location` is built.
 */
export interface AddedChecklistItem {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task with its checklist, as task-service answered it.
   *
   * @type {TaskServiceDocument}
   * @readonly
   */
  readonly task: TaskServiceDocument;

  /**
   * Property checklistItemId
   *
   * @description
   * Id of the item (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly checklistItemId: string;
  // #endregion
}
