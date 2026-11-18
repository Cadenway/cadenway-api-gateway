import type { AnswerSignInChallengeWithSecurityKeyInput } from './answer-sign-in-challenge-with-security-key.input.js';
import type { SessionIssued } from '../../../../models/auth/session-issued.model.js';
import type { IdentityAuth } from '../../../../ports/outbound/identity/auth/identity-auth.port.js';

/**
 * Class AnswerSignInChallengeWithSecurityKey
 *
 * @description
 * Answers a two-step challenge with the answer of a security key: Identity opens the session on the right answer, and counts a wrong one towards the lockout of the two-step answers of the account.
 */
export class AnswerSignInChallengeWithSecurityKey {
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
   * Answers the challenge.
   *
   * @param {AnswerSignInChallengeWithSecurityKeyInput} input - The answer and the browser.
   * @returns {Promise<SessionIssued>} The session opened, and the trusted device with `trustDevice`.
   */
  public execute(input: AnswerSignInChallengeWithSecurityKeyInput): Promise<SessionIssued> {
    return this.identity.answerSignInChallengeWithSecurityKey(input);
  }
  // #endregion
}
