import type { ReauthenticateInput } from './reauthenticate.input.js';
import type { RecentAuthentication } from '../../../../models/auth/recent-authentication.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class Reauthenticate
 *
 * @description
 * Confirms the password of the person of a session through Identity, which opens the window of
 * recent authentication of that session and counts a wrong password towards the lockout.
 */
export class Reauthenticate {
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
   * Confirms the password in the session.
   *
   * @param {ReauthenticateInput} input - Session of the request and password.
   * @returns {Promise<RecentAuthentication>} The window of recent authentication.
   */
  public execute(input: ReauthenticateInput): Promise<RecentAuthentication> {
    return this.identity.reauthenticate(input.sessionId, input.password);
  }
  // #endregion
}
