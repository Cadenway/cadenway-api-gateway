import type { WebAuthnCredentialDescriptor } from './webauthn-credential-descriptor.model.js';

/**
 * Interface WebAuthnCreationOptions
 *
 * @description
 * `PublicKeyCredentialCreationOptionsJSON`, as identity-service builds it: the web application
 * passes the whole object to the browser, so the members the contract does not list
 * (`authenticatorSelection`, `attestation`, `extensions`, `hints`) are kept.
 */
export interface WebAuthnCreationOptions {
  // #region Properties
  /**
   * Property challenge
   *
   * @description
   * The WebAuthn challenge, base64url, valid once.
   *
   * @type {string}
   * @readonly
   */
  readonly challenge: string;

  /**
   * Property rp
   *
   * @description
   * The relying party.
   *
   * @type {{ readonly name: string; readonly [member: string]: unknown }}
   * @readonly
   */
  readonly rp: { readonly name: string; readonly [member: string]: unknown };

  /**
   * Property user
   *
   * @description
   * The opaque WebAuthn handle of the account and its names.
   *
   * @type {{ readonly id: string; readonly name: string; readonly displayName: string; readonly [member: string]: unknown }}
   * @readonly
   */
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly displayName: string;
    readonly [member: string]: unknown;
  };

  /**
   * Property pubKeyCredParams
   *
   * @description
   * The COSE algorithms the relying party accepts.
   *
   * @type {readonly { readonly type: string; readonly alg: number; readonly [member: string]: unknown }[]}
   * @readonly
   */
  readonly pubKeyCredParams: readonly {
    readonly type: string;
    readonly alg: number;
    readonly [member: string]: unknown;
  }[];

  /**
   * Property excludeCredentials
   *
   * @description
   * The keys the account already has, which the browser refuses to register again.
   *
   * @type {readonly WebAuthnCredentialDescriptor[] | undefined}
   * @readonly
   */
  readonly excludeCredentials?: readonly WebAuthnCredentialDescriptor[];
  // #endregion

  /**
   * Members the contract lists as optional (`timeout`) or does not list, passed on unchanged.
   */
  readonly [member: string]: unknown;
}
