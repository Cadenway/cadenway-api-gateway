import type { CodeRequest } from '../../../../models/auth/code-request.model.js';
import type { CodeSent } from '../../../../models/auth/code-sent.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class ResendSignUpCode
 *
 * @description
 * Requests another code for an unverified account.
 */
export class ResendSignUpCode {
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
   * Requests another code for an unverified account.
   *
   * @param {CodeRequest} input - Input selected by the presentation boundary.
   * @returns {Promise<CodeSent>} The outcome provided by Identity.
   */
  public execute(input: CodeRequest): Promise<CodeSent> {
    return this.identity.resendSignUpCode(input);
  }
  // #endregion
}
