import type { TaskServiceDocument } from '../task-service/task-service-document.model.js';

/**
 * Interface VersionedGrant
 *
 * @description
 * What giving or changing a grant answers: the grant, which carries no version of its own, and
 * the version of the space or the list after the change, from which the public `ETag` is built.
 */
export interface VersionedGrant {
  // #region Properties
  /**
   * Property grant
   *
   * @description
   * The grant, as task-service answered it.
   *
   * @type {TaskServiceDocument}
   * @readonly
   */
  readonly grant: TaskServiceDocument;

  /**
   * Property version
   *
   * @description
   * Version of the space for a grant of a space, of the list for a grant of a list, after the
   * change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
