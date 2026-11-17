import type { MyOrganization } from './my-organization.model.js';

/**
 * Interface MyOrganizationPage
 *
 * @description
 * One page of the organizations of the caller.
 */
export interface MyOrganizationPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The organizations of the page.
   *
   * @type {readonly MyOrganization[]}
   * @readonly
   */
  readonly items: readonly MyOrganization[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page; `null` on the last page.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}
