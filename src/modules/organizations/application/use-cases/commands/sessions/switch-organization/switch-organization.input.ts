/**
 * Interface SwitchOrganizationInput
 *
 * @description
 * The choice of the current organization of a session.
 */
export interface SwitchOrganizationInput {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * Id of the session of the request, as the introspection returned it; never an id the request
   * names.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization to act on, one the caller belongs to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}
