/**
 * Interface AuthenticatorAppSetup
 *
 * @description
 * The pending setup of an authenticator app, with its secret, returned once. A secret: never logged.
 */
export interface AuthenticatorAppSetup {
  // #region Properties
  /**
   * Property secret
   *
   * @description
   * The TOTP secret, base32. Never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;

  /**
   * Property otpauthUri
   *
   * @description
   * The `otpauth://` URI of the secret, drawn as a QR code. Never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly otpauthUri: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the pending setup stops working, 15 minutes later.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}
