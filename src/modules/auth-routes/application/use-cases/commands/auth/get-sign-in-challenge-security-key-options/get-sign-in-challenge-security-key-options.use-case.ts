import type { GetSignInChallengeSecurityKeyOptionsInput } from './get-sign-in-challenge-security-key-options.input.js';
import type { SecurityKeyAssertionOptions } from '../../../../models/auth/security-key-assertion-options.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class GetSignInChallengeSecurityKeyOptions
 *
 * @description
 * Asks Identity for new WebAuthn options to answer a two-step challenge with a security key; they replace the previous options of the challenge.
 */
export class GetSignInChallengeSecurityKeyOptions {
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
   * Binds the outbound port of the operation.
   *
   * @param {IdentityAuth} identity - The owning capability port for Identity.
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
   * Issues the options.
   *
   * @param {GetSignInChallengeSecurityKeyOptionsInput} input - The token of the challenge.
   * @returns {Promise<SecurityKeyAssertionOptions>} The options for the browser and their expiry.
   */
  public execute(
    input: GetSignInChallengeSecurityKeyOptionsInput,
  ): Promise<SecurityKeyAssertionOptions> {
    return this.identity.getSignInChallengeSecurityKeyOptions(input);
  }
  // #endregion
}
