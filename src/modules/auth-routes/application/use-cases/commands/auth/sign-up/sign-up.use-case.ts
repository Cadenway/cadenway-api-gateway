import type { SignUpInput } from './sign-up.input.js';
import type { CodeSent } from '../../../../models/auth/code-sent.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class SignUp
 *
 * @description
 * Registers an unverified account and requests a verification code.
 */
export class SignUp {
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
   * Registers an unverified account and requests a verification code.
   *
   * @param {SignUpInput} input - Input selected by the presentation boundary.
   * @returns {Promise<CodeSent>} The outcome provided by Identity.
   */
  public execute(input: SignUpInput): Promise<CodeSent> {
    return this.identity.signUp(input);
  }
  // #endregion
}
