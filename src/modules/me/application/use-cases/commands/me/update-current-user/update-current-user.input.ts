import type { ProfileChanges } from '../../../../models/me/profile-changes.model.js';

/**
 * Interface UpdateCurrentUserInput
 *
 * @description
 * A change of the profile of the account of the verified session.
 */
export interface UpdateCurrentUserInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account, as the introspection of the session returned it; never an id the request
   * names.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property changes
   *
   * @description
   * The JSON Merge Patch of the profile.
   *
   * @type {ProfileChanges}
   * @readonly
   */
  readonly changes: ProfileChanges;

  /**
   * Property ifMatch
   *
   * @description
   * `If-Match` of the public request, relayed unchanged; `undefined` without one.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly ifMatch: string | undefined;
  // #endregion
}
