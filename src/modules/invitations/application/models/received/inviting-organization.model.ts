/**
 * Interface InvitingOrganization
 *
 * @description
 * The organization of an invitation, as the invitee sees it before joining.
 */
export interface InvitingOrganization {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the organization (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property slug
   *
   * @description
   * Address of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly slug: string;

  /**
   * Property description
   *
   * @description
   * Description of the organization; `null` when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property memberCount
   *
   * @description
   * Members that take a seat; guests are not counted.
   *
   * @type {number}
   * @readonly
   */
  readonly memberCount: number;
  // #endregion
}
