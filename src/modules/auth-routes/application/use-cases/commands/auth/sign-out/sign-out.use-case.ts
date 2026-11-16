import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class SignOut
 *
 * @description
 * Revokes the current session through Identity.
 */
export class SignOut {
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
   * Revokes the current session through Identity.
   *
   * @param {string} input - Input selected by the presentation boundary.
   * @returns {Promise<void>} The outcome provided by Identity.
   */
  public execute(input: string): Promise<void> {
    return this.identity.revokeSession(input);
  }
  // #endregion
}
