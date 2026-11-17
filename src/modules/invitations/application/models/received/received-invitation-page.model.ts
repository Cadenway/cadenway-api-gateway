import type { ReceivedInvitation } from './received-invitation.model.js';

/**
 * Interface ReceivedInvitationPage
 *
 * @description
 * One page of the invitations addressed to the caller.
 */
export interface ReceivedInvitationPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The invitations of the page, the most recently sent first.
   *
   * @type {readonly ReceivedInvitation[]}
   * @readonly
   */
  readonly items: readonly ReceivedInvitation[];

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
