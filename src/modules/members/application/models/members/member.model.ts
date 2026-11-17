/**
 * Interface Member
 *
 * @description
 * A member of the current organization, as organization-service answers it.
 */
export interface Member {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the membership (a UUID), the `memberId` of the routes.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * Id of the account (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Full name of the account, from the user directory of organization-service.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property role
   *
   * @description
   * Role in the organization.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';

  /**
   * Property joinedAt
   *
   * @description
   * When the member joined, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly joinedAt: string;

  /**
   * Property version
   *
   * @description
   * Version of the membership, also its entity tag.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
