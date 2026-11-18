import type { TaskServiceDocument } from '../task-service/task-service-document.model.js';

/**
 * Interface TaskDetail
 *
 * @description
 * The detail of a task as the gateway composes it: the core task-service owns (the task, its
 * space, its list, its parent and its direct subtasks), the secondary parts that answered, by
 * name, and the names of those that did not. In this version task-service is the only source:
 * `parts` is empty and `partial` is `[]`.
 */
export interface TaskDetail {
  // #region Properties
  /**
   * Property core
   *
   * @description
   * `TaskDetailCore` of task-service, checked against its internal contract.
   *
   * @type {TaskServiceDocument}
   * @readonly
   */
  readonly core: TaskServiceDocument;

  /**
   * Property parts
   *
   * @description
   * The secondary parts that answered in time, by the name the public contract gives them.
   *
   * @type {ReadonlyMap<string, TaskServiceDocument>}
   * @readonly
   */
  readonly parts: ReadonlyMap<string, TaskServiceDocument>;

  /**
   * Property partial
   *
   * @description
   * The names of the secondary parts that failed or did not answer in time, in the order of the
   * parts; the rest of the detail is complete.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly partial: readonly string[];
  // #endregion
}
