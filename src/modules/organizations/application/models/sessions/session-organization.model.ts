/**
 * Interface SessionOrganization
 *
 * @description
 * The current organization of a session, as identity-service answers its choice.
 */
export interface SessionOrganization {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The current organization of the session from now on.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property role
   *
   * @description
   * Role of the caller in it, from the copy of the memberships of identity-service.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
