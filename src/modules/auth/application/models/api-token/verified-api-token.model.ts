/**
 * Interface VerifiedApiToken
 *
 * @description
 * What identity-service answered for an active personal API token: the only source of the
 * identity of a request authenticated by `Authorization: Bearer`. Nothing here is read from the
 * request itself, and the secret of the token is not part of it.
 */
export interface VerifiedApiToken {
  // #region Properties
  /**
   * Property apiTokenId
   *
   * @description
   * Id of the token (a UUID), not its secret: the rate limit counts requests on it.
   *
   * @type {string}
   * @readonly
   */
  readonly apiTokenId: string;

  /**
   * Property userId
   *
   * @description
   * Id of the account the token acts for (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property organizationId
   *
   * @description
   * Organization the token acts in, the one it was created in.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property role
   *
   * @description
   * Role of the user in that organization, from the copy of the memberships of identity-service.
   * Carried in the internal token; organization-service decides from its own members.
   *
   * @type {string}
   * @readonly
   */
  readonly role: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes of the token; a route whose `apiToken` requirement names a scope it lacks refuses it.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

  /**
   * Property expiresAt
   *
   * @description
   * When the token stops working, as an ISO 8601 instant; `null` for a token without expiry.
   *
   * @type {string | null}
   * @readonly
   */
  readonly expiresAt: string | null;
  // #endregion
}
