/**
 * Interface ApiToken
 *
 * @description
 * A personal API token of the caller in the current organization, never with its secret.
 */
export interface ApiToken {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the token (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the token.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property prefix
   *
   * @description
   * First 11 characters of the secret, to recognize the token.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes of the token.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

  /**
   * Property organizationId
   *
   * @description
   * Organization the token acts in.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

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
   * Property expiresAt
   *
   * @description
   * When the token stops working; `null` without expiry.
   *
   * @type {string | null}
   * @readonly
   */
  readonly expiresAt: string | null;

  /**
   * Property lastUsedAt
   *
   * @description
   * Last request made with it, to the minute; `null` before the first.
   *
   * @type {string | null}
   * @readonly
   */
  readonly lastUsedAt: string | null;
  // #endregion
}
