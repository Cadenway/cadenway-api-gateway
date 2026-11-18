/**
 * Interface WebAuthnCredentialDescriptor
 *
 * @description
 * A WebAuthn credential of the account, by id (`PublicKeyCredentialDescriptorJSON`). The members
 * the contract does not list are kept: the browser reads them.
 */
export interface WebAuthnCredentialDescriptor {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the credential, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property type
   *
   * @description
   * `public-key`.
   *
   * @type {string}
   * @readonly
   */
  readonly type: string;

  /**
   * Property transports
   *
   * @description
   * How the browser reaches the key.
   *
   * @type {readonly string[] | undefined}
   * @readonly
   */
  readonly transports?: readonly string[];
  // #endregion

  /**
   * Members the contract does not list, passed on unchanged.
   */
  readonly [member: string]: unknown;
}
