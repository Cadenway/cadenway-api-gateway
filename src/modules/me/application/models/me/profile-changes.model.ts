/**
 * Interface ProfileChanges
 *
 * @description
 * A JSON Merge Patch of the profile of an account: a member left out is unchanged, `null` clears
 * `displayName` or `jobTitle`. identity-service checks and applies it.
 */
export interface ProfileChanges {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name ("Nom complet"), as typed.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly name?: string;

  /**
   * Property displayName
   *
   * @description
   * Name used for the mentions ("Nom affiché"); `null` clears it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly displayName?: string | null;

  /**
   * Property jobTitle
   *
   * @description
   * Job title ("Poste"); `null` clears it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly jobTitle?: string | null;

  /**
   * Property timeZone
   *
   * @description
   * IANA time zone name ("Fuseau horaire"), checked by identity-service.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly timeZone?: string;

  /**
   * Property language
   *
   * @description
   * Language of the account and of its emails ("Langue").
   *
   * @type {'fr' | 'en' | 'de' | 'es' | undefined}
   * @readonly
   */
  readonly language?: 'fr' | 'en' | 'de' | 'es';
  // #endregion
}
