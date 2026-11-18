import type { WebAuthnCredentialDescriptor } from './webauthn-credential-descriptor.model.js';

/**
 * Interface WebAuthnRequestOptions
 *
 * @description
 * `PublicKeyCredentialRequestOptionsJSON`, as identity-service builds it: the web application
 * passes the whole object to the browser, so the members the contract does not list are kept.
 */
export interface WebAuthnRequestOptions {
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
   * Property allowCredentials
   *
   * @description
   * The keys of the account; no other key can answer.
   *
   * @type {readonly WebAuthnCredentialDescriptor[] | undefined}
   * @readonly
   */
  readonly allowCredentials?: readonly WebAuthnCredentialDescriptor[];
  // #endregion

  /**
   * Members the contract lists as optional (`rpId`, `timeout`, `userVerification`) or does not
   * list, passed on unchanged.
   */
  readonly [member: string]: unknown;
}
