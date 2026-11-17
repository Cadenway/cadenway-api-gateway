/**
 * Interface RefuseInvitationInput
 *
 * @description
 * The refusal of an invitation addressed to the caller.
 */
export interface RefuseInvitationInput {
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
   * Property invitationId
   *
   * @description
   * Id of the invitation.
   *
   * @type {string}
   * @readonly
   */
  readonly invitationId: string;
  // #endregion
}
