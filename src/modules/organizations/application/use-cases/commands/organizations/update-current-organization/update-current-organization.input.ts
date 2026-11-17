import type { OrganizationChanges } from '../../../../models/organizations/organization-changes.model.js';

/**
 * Interface UpdateCurrentOrganizationInput
 *
 * @description
 * A change of the current organization.
 */
export interface UpdateCurrentOrganizationInput {
  // #region Properties
  /**
   * Property changes
   *
   * @description
   * The JSON Merge Patch of the organization.
   *
   * @type {OrganizationChanges}
   * @readonly
   */
  readonly changes: OrganizationChanges;

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
