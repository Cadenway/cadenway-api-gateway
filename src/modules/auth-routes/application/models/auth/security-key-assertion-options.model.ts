import type { WebAuthnRequestOptions } from './webauthn-request-options.model.js';

/**
 * Interface SecurityKeyAssertionOptions
 *
 * @description
 * The options a browser needs to ask a security key to answer a two-step challenge.
 */
export interface SecurityKeyAssertionOptions {
  // #region Properties
  /**
   * Property options
   *
   * @description
   * The WebAuthn request options.
   *
   * @type {WebAuthnRequestOptions}
   * @readonly
   */
  readonly options: WebAuthnRequestOptions;

  /**
   * Property expiresAt
   *
   * @description
   * When the options stop working, 5 minutes later.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}
