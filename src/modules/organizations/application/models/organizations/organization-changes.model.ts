/**
 * Interface OrganizationChanges
 *
 * @description
 * A JSON Merge Patch of the current organization: a member left out is unchanged, `null` clears
 * `description` or `website`. organization-service checks the role of the caller and applies it.
 */
export interface OrganizationChanges {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * New name.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly name?: string;

  /**
   * Property slug
   *
   * @description
   * New address.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly slug?: string;

  /**
   * Property description
   *
   * @description
   * New description; `null` clears it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly description?: string | null;

  /**
   * Property website
   *
   * @description
   * New website; `null` clears it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly website?: string | null;

  /**
   * Property defaultLanguage
   *
   * @description
   * New default language.
   *
   * @type {'fr' | 'en' | 'de' | undefined}
   * @readonly
   */
  readonly defaultLanguage?: 'fr' | 'en' | 'de';
  // #endregion
}
