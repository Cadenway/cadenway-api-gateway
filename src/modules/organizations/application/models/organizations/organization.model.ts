/**
 * Interface Organization
 *
 * @description
 * An organization as organization-service answers it, with the role of the caller in it.
 */
export interface Organization {
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
   * Name ("Nom").
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property slug
   *
   * @description
   * Address ("Adresse"), unique across organizations.
   *
   * @type {string}
   * @readonly
   */
  readonly slug: string;

  /**
   * Property description
   *
   * @description
   * Description, up to 280 characters; `null` when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property website
   *
   * @description
   * Absolute URL of the website; `null` when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly website: string | null;

  /**
   * Property defaultLanguage
   *
   * @description
   * BCP 47 tag of the default language.
   *
   * @type {string}
   * @readonly
   */
  readonly defaultLanguage: string;

  /**
   * Property plan
   *
   * @description
   * Plan of the organization; `free` until billing exists.
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;

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
   * Property role
   *
   * @description
   * Role of the caller in the organization.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';

  /**
   * Property createdAt
   *
   * @description
   * Creation instant, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;

  /**
   * Property version
   *
   * @description
   * Version of the organization, also its entity tag.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
