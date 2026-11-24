import type { AddedChecklistItem } from '../../../../models/checklist/added-checklist-item.model.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface TaskRegistry
 *
 * @description
 * Outgoing port of the tasks routes: the tasks of task-service, called as the user of the current
 * organization context, in the organization of its internal token. task-service decides who sees
 * what and every rule; what the actor does not see answers `404`.
 *
 * Every method resolves with an answer that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of task-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface TaskRegistry {
  // #region Methods
  /** Relays an atomic bulk task action to task-service. */
  executeBulkTaskAction(
    body: TaskServiceDocument,
    key: string | undefined,
  ): Promise<TaskServiceDocument>;

  /** Relays duplicateTask to task-service. */
  duplicateTask(
    taskKey: string,
    body: TaskServiceDocument,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method listTasks
   *
   * @description
   * `GET /internal/v1/lists/{listId}/tasks`. Lists the tasks of a list, filtered and sorted.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listTasks(
    listId: string,
    query: TaskServiceDocument,
    method?: 'QUERY',
  ): Promise<TaskServiceDocument>;

  /**
   * Method createTask
   *
   * @description
   * `POST /internal/v1/lists/{listId}/tasks`. Creates a task and its subtasks in a list.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  createTask(
    listId: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method countTaskGroups
   *
   * @description
   * `GET /internal/v1/lists/{listId}/task-groups`. Counts the tasks of a list by group.
   *
   * @param {string} listId - Id of the list.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  countTaskGroups(
    listId: string,
    query: TaskServiceDocument,
    method?: 'QUERY',
  ): Promise<TaskServiceDocument>;

  /**
   * Method getTask
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}`. Reads a task the actor sees.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  getTask(taskKey: string): Promise<TaskServiceDocument>;

  /**
   * Method updateTask
   *
   * @description
   * `PATCH /internal/v1/tasks/{taskKey}`. Changes a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  updateTask(
    taskKey: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method listSubtasks
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}/subtasks`. Lists the direct subtasks of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listSubtasks(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method createSubtask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/subtasks`. Creates a subtask under a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  createSubtask(
    taskKey: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method addChecklistItem
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/checklist-items`. Adds an item to the checklist of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} creation - The body the public validator accepted.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<AddedChecklistItem>} The task and the id of the item.
   */
  addChecklistItem(
    taskKey: string,
    creation: TaskServiceDocument,
    idempotencyKey: string | undefined,
  ): Promise<AddedChecklistItem>;

  /**
   * Method updateChecklistItem
   *
   * @description
   * `PATCH /internal/v1/tasks/{taskKey}/checklist-items/{checklistItemId}`. Ticks or unticks an item of the checklist of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} checklistItemId - Id of the checklist item.
   * @param {TaskServiceDocument} patch - The JSON Merge Patch the public validator accepted.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  updateChecklistItem(
    taskKey: string,
    checklistItemId: string,
    patch: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method assignTask
   *
   * @description
   * `PUT /internal/v1/tasks/{taskKey}/assignees/{userId}`. Assigns a member to a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Id of the account.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  assignTask(
    taskKey: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method unassignTask
   *
   * @description
   * `DELETE /internal/v1/tasks/{taskKey}/assignees/{userId}`. Unassigns a member from a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Id of the account.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the task after the change.
   */
  unassignTask(taskKey: string, userId: string, ifMatch: string | undefined): Promise<number>;

  /**
   * Method addTaskLabel
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/labels/add`. Adds a label to a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} change - The label, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  addTaskLabel(
    taskKey: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method removeTaskLabel
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/labels/remove`. Removes a label from a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} change - The label, as the public validator accepted it.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  removeTaskLabel(
    taskKey: string,
    change: TaskServiceDocument,
    ifMatch: string | undefined,
  ): Promise<TaskServiceDocument>;

  /**
   * Method listTaskActivity
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}/activity`. Lists the activity of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listTaskActivity(taskKey: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method listLabels
   *
   * @description
   * `GET /internal/v1/labels`. Lists the labels of the organization.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listLabels(query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method listMyTasks
   *
   * @description
   * `GET /internal/v1/users/{userId}/tasks`. Lists the tasks of the user of the context ("Mes tâches").
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  listMyTasks(userId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;

  /**
   * Method getHome
   *
   * @description
   * `GET /internal/v1/users/{userId}/home`. Reads the task part of "Accueil" for the user of the context.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  getHome(userId: string, query: TaskServiceDocument): Promise<TaskServiceDocument>;
  // #endregion
}
