import type { RequestPasswordResetInput } from './request-password-reset.input.js';
import type { PasswordResetLinkSent } from '../../../../models/auth/password-reset-link-sent.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class RequestPasswordReset
 *
 * @description
 * Asks Identity for a password reset link; Identity answers the same way whether or not an account
 * uses the address, and throttles the requests of the address.
 */
export class RequestPasswordReset {
  // #region Properties
  /**
   * Property identity
   *
   * @description
   * The owning capability port for Identity.
   *
   * @type {IdentityAuth}
   * @readonly
   */
  private readonly identity: IdentityAuth;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the Identity port for the application operation.
   *
   * @param {IdentityAuth} identity - Identity capability port.
   * @constructor
   */
  public constructor(identity: IdentityAuth) {
    this.identity = identity;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Asks Identity for a password reset link.
   *
   * @param {RequestPasswordResetInput} input - Address and browser.
   * @returns {Promise<PasswordResetLinkSent>} The same answer whether or not a link was issued.
   */
  public execute(input: RequestPasswordResetInput): Promise<PasswordResetLinkSent> {
    return this.identity.requestPasswordReset(input);
  }
  // #endregion
}
