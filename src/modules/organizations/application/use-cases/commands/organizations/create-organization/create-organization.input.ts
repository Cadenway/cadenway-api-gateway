/**
 * Interface CreateOrganizationInput
 *
 * @description
 * An organization to create, owned by the caller, with the addresses to invite as `member`.
 */
export interface CreateOrganizationInput {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name ("Nom"), as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property slug
   *
   * @description
   * Address to use; organization-service derives it from the name when absent.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly slug?: string;

  /**
   * Property teamSize
   *
   * @description
   * "Taille de l'équipe".
   *
   * @type {'1-5' | '6-20' | '21-100' | 'over-100'}
   * @readonly
   */
  readonly teamSize: '1-5' | '6-20' | '21-100' | 'over-100';

  /**
   * Property primaryUse
   *
   * @description
   * "Usage principal".
   *
   * @type {'product-engineering' | 'agency-client-projects' | 'marketing-content' | 'operations-support' | 'other'}
   * @readonly
   */
  readonly primaryUse:
    | 'product-engineering'
    | 'agency-client-projects'
    | 'marketing-content'
    | 'operations-support'
    | 'other';

  /**
   * Property inviteEmails
   *
   * @description
   * Addresses to invite as `member` ("Inviter des collègues").
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly inviteEmails: readonly string[];
  // #endregion
}
