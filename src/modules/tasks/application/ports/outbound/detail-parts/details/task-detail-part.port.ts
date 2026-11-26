import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';

/**
 * Interface TaskDetailPart
 *
 * @description
 * Outgoing port of one secondary part of the task detail, read from the service that owns it
 * (comments from task-service, development from integration-service). A failure or timeout
 * normally leaves the part out and names it in `partial`; a visibility denial can instead fail
 * the detail.
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

  /**
   * Property afterCore
   *
   * @description
   * Whether the part is read only once the core has answered. A service that does not decide
   * task visibility (integration-service for the Git links) is called only after task-service
   * has let the actor read the task; its part deadline starts then. Read with the core when
   * omitted.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly afterCore?: boolean;
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the part of the task while the aggregate still needs it.
   *
   * @param {string} taskKey - Key of the task.
   * @param {AbortSignal} signal - Cancels the read on timeout or core failure.
   * @returns {Promise<TaskServiceDocument>} The part, as its service answered it.
   */
  read(taskKey: string, signal: AbortSignal): Promise<TaskServiceDocument>;

  /** Whether a failed read must fail the entire detail. */
  failsDetail?(error: unknown): boolean;
  // #endregion
}
