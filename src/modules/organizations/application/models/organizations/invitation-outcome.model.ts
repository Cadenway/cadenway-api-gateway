/**
 * Interface InvitationOutcome
 *
 * @description
 * What became of one address invited with the creation of an organization.
 */
export interface InvitationOutcome {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property outcome
   *
   * @description
   * `invited`, `already-member` or `already-invited` today; later versions add outcomes.
   *
   * @type {string}
   * @readonly
   */
  readonly outcome: string;

  /**
   * Property invitationId
   *
   * @description
   * The invitation created or pending; `null` for `already-member`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly invitationId: string | null;
  // #endregion
}
