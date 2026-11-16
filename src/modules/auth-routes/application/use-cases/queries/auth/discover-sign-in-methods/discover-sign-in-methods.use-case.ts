import type { DiscoverSignInMethodsInput } from './discover-sign-in-methods.input.js';
import type { DiscoverSignInMethodsOutput } from './discover-sign-in-methods.output.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class DiscoverSignInMethods
 *
 * @description
 * Reads the sign-in methods available for the address.
 */
export class DiscoverSignInMethods {
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
   * Reads the sign-in methods available for the address.
   *
   * @param {DiscoverSignInMethodsInput} input - Input selected by the presentation boundary.
   * @returns {Promise<DiscoverSignInMethodsOutput>} The outcome provided by Identity.
   */
  public execute(input: DiscoverSignInMethodsInput): Promise<DiscoverSignInMethodsOutput> {
    return this.identity.discoverSignInMethods(input);
  }
  // #endregion
}
