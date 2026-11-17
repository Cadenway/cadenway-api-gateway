/**
 * Interface RoleCounts
 *
 * @description
 * Members of the organization by role, whatever the filters of the request.
 */
export interface RoleCounts {
  // #region Properties
  /**
   * Property owner
   *
   * @description
   * Owners: one.
   *
   * @type {number}
   * @readonly
   */
  readonly owner: number;

  /**
   * Property admin
   *
   * @description
   * Admins.
   *
   * @type {number}
   * @readonly
   */
  readonly admin: number;

  /**
   * Property member
   *
   * @description
   * Members.
   *
   * @type {number}
   * @readonly
   */
  readonly member: number;

  /**
   * Property guest
   *
   * @description
   * Guests.
   *
   * @type {number}
   * @readonly
   */
  readonly guest: number;
  // #endregion
}
