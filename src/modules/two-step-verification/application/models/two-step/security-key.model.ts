/**
 * Interface SecurityKey
 *
 * @description
 * A security key of the account, never with its public key or its credential id.
 */
export interface SecurityKey {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the key (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * The name the person gave it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property createdAt
   *
   * @description
   * When it was registered.
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;

  /**
   * Property lastUsedAt
   *
   * @description
   * Last answer of a challenge with the key; `null` before the first.
   *
   * @type {string | null}
   * @readonly
   */
  readonly lastUsedAt: string | null;
  // #endregion
}
