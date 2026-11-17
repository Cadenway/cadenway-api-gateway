/**
 * Interface ChangeMemberRoleInput
 *
 * @description
 * A change of the role of a member of the current organization.
 */
export interface ChangeMemberRoleInput {
  // #region Properties
  /**
   * Property memberId
   *
   * @description
   * Id of the membership.
   *
   * @type {string}
   * @readonly
   */
  readonly memberId: string;

  /**
   * Property role
   *
   * @description
   * The role to give; never `owner`.
   *
   * @type {'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'admin' | 'member' | 'guest';

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
