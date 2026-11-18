import type { SignInWithPasswordInput } from './sign-in-with-password.input.js';
import type { SignInOutcome } from '../../../../models/auth/sign-in-outcome.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class SignInWithPassword
 *
 * @description
 * Opens a session when Identity accepts the email and password.
 */
export class SignInWithPassword {
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
   * Opens a session when Identity accepts the email and password.
   *
   * @param {SignInWithPasswordInput} input - Input selected by the presentation boundary.
   * @returns {Promise<SignInOutcome>} The session opened, or the two-step challenge of an
   * account with two-step verification on a device it does not trust.
   */
  public execute(input: SignInWithPasswordInput): Promise<SignInOutcome> {
    return this.identity.signInWithPassword(input);
  }
  // #endregion
}
