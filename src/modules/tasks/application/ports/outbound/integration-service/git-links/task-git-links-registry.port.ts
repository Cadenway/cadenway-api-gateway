/**
 * Interface TaskGitLinksRegistry
 *
 * @description
 * Outgoing port of the Git links of a task: the read of the task in task-service, which decides
 * whether the actor sees it, and the read of its links in integration-service, which does not.
 */
export interface TaskGitLinksRegistry {
  // #region Methods
  /**
   * Method authorize
   *
   * @description
   * Reads the task with the caller's identity.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<void>} Once task-service let the actor read the task.
   * @throws {unknown} `404 task.not-found`, `404 task.trashed` with its `details` or
   * `404 organization.not-found` as task-service answers them, or `503 upstream.*`.
   */
  authorize(taskKey: string): Promise<void>;

  /**
   * Method list
   *
   * @description
   * Reads one page of the task's Git links, newest first.
   *
   * @param {string} taskKey - Key of a task the actor may read.
   * @param {object} query - The `cursor` and `limit` of the public request.
   * @returns {Promise<object>} The page, as integration-service answered it.
   */
  list(taskKey: string, query: object): Promise<object>;
  // #endregion
}
