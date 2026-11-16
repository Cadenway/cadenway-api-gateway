import type { SignInWithPasswordInput } from './sign-in-with-password.input.js';
import type { SessionIssued } from '../../../../models/auth/session-issued.model.js';
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
   * @returns {Promise<SessionIssued>} The outcome provided by Identity.
   */
  public execute(input: SignInWithPasswordInput): Promise<SessionIssued> {
    return this.identity.signInWithPassword(input);
  }
  // #endregion
}
