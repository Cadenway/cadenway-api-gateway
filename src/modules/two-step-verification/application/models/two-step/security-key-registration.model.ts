import type { WebAuthnCreationOptions } from './webauthn-creation-options.model.js';

/**
 * Interface SecurityKeyRegistration
 *
 * @description
 * The pending registration of a security key of a session: the options the browser needs.
 */
export interface SecurityKeyRegistration {
  // #region Properties
  /**
   * Property options
   *
   * @description
   * The WebAuthn creation options.
   *
   * @type {WebAuthnCreationOptions}
   * @readonly
   */
  readonly options: WebAuthnCreationOptions;

  /**
   * Property expiresAt
   *
   * @description
   * When the pending registration stops working, 5 minutes later.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}
