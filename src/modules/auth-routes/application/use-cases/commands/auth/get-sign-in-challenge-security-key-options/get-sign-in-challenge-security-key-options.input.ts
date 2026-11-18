/**
 * Interface GetSignInChallengeSecurityKeyOptionsInput
 *
 * @description
 * The token of a two-step challenge to answer with a security key.
 */
export interface GetSignInChallengeSecurityKeyOptionsInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the challenge, as its `202` gave it. A secret: never logged, never in a URL.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}
