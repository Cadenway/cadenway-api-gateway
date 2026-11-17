import type { ConfirmPasswordResetInput } from './confirm-password-reset.input.js';
import type { PasswordResetCompleted } from '../../../../models/auth/password-reset-completed.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class ConfirmPasswordReset
 *
 * @description
 * Sets a new password with a reset link through Identity, which uses the link up and never signs
 * in.
 */
export class ConfirmPasswordReset {
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
   * Sets the new password of the account of the link.
   *
   * @param {ConfirmPasswordResetInput} input - Token, new password, sessions choice and browser.
   * @returns {Promise<PasswordResetCompleted>} The address of the account and the sessions closed.
   */
  public execute(input: ConfirmPasswordResetInput): Promise<PasswordResetCompleted> {
    return this.identity.confirmPasswordReset(input);
  }
  // #endregion
}
