/**
 * Interface SecurityKeyAttestation
 *
 * @description
 * The answer of the browser to the registration options of a security key
 * (`RegistrationResponseJSON`), as it serialized it and the public contract validated it. The
 * members the contract does not list are kept, for identity-service, which verifies the whole
 * answer. Never logged.
 */
export interface SecurityKeyAttestation {
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
   * The attestation of the key, with the members the contract does not list.
   *
   * @type {{ readonly clientDataJSON: string; readonly attestationObject: string; readonly transports?: readonly string[]; readonly [member: string]: unknown }}
   * @readonly
   */
  readonly response: {
    readonly clientDataJSON: string;
    readonly attestationObject: string;
    readonly transports?: readonly string[];
    readonly [member: string]: unknown;
  };
  // #endregion

  /**
   * Members the contract lists as optional (`authenticatorAttachment`,
   * `clientExtensionResults`) or does not list, passed on unchanged.
   */
  readonly [member: string]: unknown;
}
