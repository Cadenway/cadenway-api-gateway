/**
 * Interface MyOrganization
 *
 * @description
 * An organization of the caller, as the picker lists it.
 */
export interface MyOrganization {
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
   * Property role
   *
   * @description
   * Role of the caller in it.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';

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

  /**
   * Property plan
   *
   * @description
   * Plan of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;

  /**
   * Property joinedAt
   *
   * @description
   * When the caller joined it, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly joinedAt: string;
  // #endregion
}
