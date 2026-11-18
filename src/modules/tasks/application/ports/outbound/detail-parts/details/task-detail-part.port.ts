import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface TaskDetailPart
 *
 * @description
 * Outgoing port of one secondary part of the task detail, read from the service that owns it
 * (attachments, development links, comments in later versions; none in this one). Its failure, or
 * no answer within the part deadline of `GetTaskDetail`, leaves the part out and names it in
 * `partial`, never fails the detail.
 */
export interface TaskDetailPart {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name of the part in the public contract and in `partial` (`attachments`, `development`,
   * `comments`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the part of the task.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskServiceDocument>} The part, as its service answered it.
   */
  read(taskKey: string): Promise<TaskServiceDocument>;
  // #endregion
}
