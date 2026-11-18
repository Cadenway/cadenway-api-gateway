import type { Client } from '../../../../models/auth/client.model.js';

/**
 * Interface SignInWithCodeInput
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface SignInWithCodeInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property code
   *
   * @description
   * One-time proof, kept out of logs.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property rememberMe
   *
   * @description
   * Whether the session survives the browser.
   *
   * @type {boolean}
   * @readonly
   */
  readonly rememberMe?: boolean;

  /**
   * Property client
   *
   * @description
   * Browser for which the session is opened.
   *
   * @type {Client}
   * @readonly
   */
  readonly client: Client;

  /**
   * Property trustedDeviceToken
   *
   * @description
   * The device token of the cookie `__Host-cw_trusted_device` of the browser, when it sent one of
   * 1 to 256 characters: identity-service skips the two-step challenge for a device the account
   * trusts. A secret: never logged.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly trustedDeviceToken?: string;
  // #endregion
}
