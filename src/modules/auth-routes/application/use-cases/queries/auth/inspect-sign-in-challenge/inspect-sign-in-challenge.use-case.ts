import type { InspectSignInChallengeInput } from './inspect-sign-in-challenge.input.js';
import type { SignInChallenge } from '../../../../models/auth/sign-in-challenge.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class InspectSignInChallenge
 *
 * @description
 * Reads a two-step challenge again, without answering it or counting an attempt.
 */
export class InspectSignInChallenge {
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
   * Reads the challenge.
   *
   * @param {InspectSignInChallengeInput} input - The token of the challenge.
   * @returns {Promise<SignInChallenge>} The challenge, as the sign-in issued it.
   */
  public execute(input: InspectSignInChallengeInput): Promise<SignInChallenge> {
    return this.identity.inspectSignInChallenge(input);
  }
  // #endregion
}
