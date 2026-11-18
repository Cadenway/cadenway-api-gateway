/**
 * Interface SecurityKeyAssertion
 *
 * @description
 * The answer of a security key to the options of a challenge (`AuthenticationResponseJSON`), as
 * the browser serialized it and the public contract validated it. The members the contract does
 * not list are kept, for identity-service, which verifies the whole answer. A secret of the
 * moment: never logged.
 */
export interface SecurityKeyAssertion {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the credential.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property rawId
   *
   * @description
   * Raw id of the credential, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly rawId: string;

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
   * Property response
   *
   * @description
   * The signed data of the key, with the members the contract does not list.
   *
   * @type {{ readonly clientDataJSON: string; readonly authenticatorData: string; readonly signature: string; readonly userHandle?: string | null; readonly [member: string]: unknown }}
   * @readonly
   */
  readonly response: {
    readonly clientDataJSON: string;
    readonly authenticatorData: string;
    readonly signature: string;
    readonly userHandle?: string | null;
    readonly [member: string]: unknown;
  };
  // #endregion

  /**
   * Members the contract lists as optional (`authenticatorAttachment`,
   * `clientExtensionResults`) or does not list, passed on unchanged.
   */
  readonly [member: string]: unknown;
}
