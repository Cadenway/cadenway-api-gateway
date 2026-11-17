/**
 * Interface CreateApiTokenInput
 *
 * @description
 * A personal API token to create for the caller in the current organization of the session.
 */
export interface CreateApiTokenInput {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * Id of the session of the request, as its introspection returned it: identity-service checks
   * its recent authentication.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property name
   *
   * @description
   * Name of the token, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes of the token, at least one.
   *
   * @type {readonly ('tasks:read' | 'tasks:write' | 'members:read' | 'webhooks:manage')[]}
   * @readonly
   */
  readonly scopes: readonly ('tasks:read' | 'tasks:write' | 'members:read' | 'webhooks:manage')[];

  /**
   * Property expiration
   *
   * @description
   * Lifetime of the token, counted from the creation.
   *
   * @type {'30-days' | '90-days' | '1-year' | 'never'}
   * @readonly
   */
  readonly expiration: '30-days' | '90-days' | '1-year' | 'never';
  // #endregion
}
