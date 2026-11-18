import type { InspectPasswordResetLinkInput } from './inspect-password-reset-link.input.js';
import type { PasswordResetLink } from '../../../../models/auth/password-reset-link.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class InspectPasswordResetLink
 *
 * @description
 * Reads the account a password reset link is for, without using the link.
 */
export class InspectPasswordResetLink {
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
   * Reads the account of the link.
   *
   * @param {InspectPasswordResetLinkInput} input - The token of the link.
   * @returns {Promise<PasswordResetLink>} The address of the account, the expiry of the link and
   * the open sessions of the account.
   */
  public execute(input: InspectPasswordResetLinkInput): Promise<PasswordResetLink> {
    return this.identity.inspectPasswordResetLink(input);
  }
  // #endregion
}
