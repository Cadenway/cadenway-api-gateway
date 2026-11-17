import type { PageRequest } from '../../../../models/pages/page-request.model.js';

/**
 * Interface ListReceivedInvitationsInput
 *
 * @description
 * The page of the invitations addressed to the caller.
 */
export interface ListReceivedInvitationsInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account of the session, as the introspection returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property page
   *
   * @description
   * Cursor and page size.
   *
   * @type {PageRequest}
   * @readonly
   */
  readonly page: PageRequest;
  // #endregion
}
