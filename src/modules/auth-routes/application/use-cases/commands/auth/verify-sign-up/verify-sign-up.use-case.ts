import type { SignUpVerification } from './verify-sign-up.input.js';
import type { SessionIssued } from '../../../../models/auth/session-issued.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class VerifySignUp
 *
 * @description
 * Verifies the account registration and opens a session when Identity accepts the proof.
 */
export class VerifySignUp {
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
   * Verifies the account registration and opens a session when Identity accepts the proof.
   *
   * @param {SignUpVerification} input - Input selected by the presentation boundary.
   * @returns {Promise<SessionIssued>} The outcome provided by Identity.
   */
  public execute(input: SignUpVerification): Promise<SessionIssued> {
    return this.identity.verifySignUp(input);
  }
  // #endregion
}
