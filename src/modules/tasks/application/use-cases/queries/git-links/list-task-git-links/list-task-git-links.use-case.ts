import type { TaskGitLinksRegistry } from '../../../../ports/outbound/integration-service/git-links/task-git-links-registry.port.js';

/**
 * Class ListTaskGitLinks
 *
 * @description
 * Lists the Git links of a task the caller sees. task-service reads the task first with the
 * caller's identity; integration-service is called only once that read succeeded, since it
 * bounds the read by organization and task key but decides no visibility.
 */
export class ListTaskGitLinks {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the Git links registry.
   *
   * @param {TaskGitLinksRegistry} registry - The reads of the task and of its links.
   * @constructor
   */
  public constructor(private readonly registry: TaskGitLinksRegistry) {}
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Authorizes the read through the task, then reads one page of its links.
   *
   * @param {string} taskKey - Key of the task.
   * @param {object} query - The `cursor` and `limit` of the public request.
   * @returns {Promise<object>} The page of links.
   * @throws {unknown} The task read failure, without any call to integration-service.
   */
  public async execute(taskKey: string, query: object): Promise<object> {
    await this.registry.authorize(taskKey);
    return this.registry.list(taskKey, query);
  }
  // #endregion
}
