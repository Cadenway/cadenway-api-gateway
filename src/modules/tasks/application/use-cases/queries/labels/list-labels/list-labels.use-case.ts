import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskRegistry } from '../../../../ports/outbound/task-service/tasks/task-registry.port.js';

/**
 * Class ListLabels
 *
 * @description
 * Lists the labels of the organization. Forwards `GET /internal/v1/labels` to task-service, which decides everything about it.
 */
export class ListLabels {
  // #region Properties
  /**
   * Property taskRegistry
   *
   * @description
   * The tasks of task-service.
   *
   * @type {TaskRegistry}
   * @readonly
   */
  private readonly taskRegistry: TaskRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {TaskRegistry} taskRegistry - The tasks of task-service.
   * @constructor
   */
  public constructor(taskRegistry: TaskRegistry) {
    this.taskRegistry = taskRegistry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Lists the labels of the organization.
   *
   * @param {TaskServiceDocument} query - The query the public validator accepted.
   * @returns {Promise<TaskServiceDocument>} The answer of task-service.
   */
  public execute(query: TaskServiceDocument): Promise<TaskServiceDocument> {
    return this.taskRegistry.listLabels(query);
  }
  // #endregion
}
