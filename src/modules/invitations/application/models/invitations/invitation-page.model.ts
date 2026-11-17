import type { Invitation } from './invitation.model.js';

/**
 * Interface InvitationPage
 *
 * @description
 * One page of the pending invitations of the current organization.
 */
export interface InvitationPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The invitations of the page, the most recently sent first.
   *
   * @type {readonly Invitation[]}
   * @readonly
   */
  readonly items: readonly Invitation[];

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

  /**
   * Property total
   *
   * @description
   * Pending invitations of the organization, on every page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}
