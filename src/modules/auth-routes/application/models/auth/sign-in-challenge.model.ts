/**
 * Interface SignInChallenge
 *
 * @description
 * A two-step challenge of a sign-in, as identity-service issued it: what the screen "Vérification
 * en deux étapes" shows, and the token its answer carries.
 */
export interface SignInChallenge {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The secret of the challenge, sent back with its answer. Never logged, never in a URL.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the challenge stops working, 10 minutes after the sign-in.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property email
   *
   * @description
   * Address of the account, shown above the challenge.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property name
   *
   * @description
   * Full name of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property primaryMethod
   *
   * @description
   * The method whose tab opens first.
   *
   * @type {string}
   * @readonly
   */
  readonly primaryMethod: string;

  /**
   * Property methods
   *
   * @description
   * The methods the account can answer with, in the order of the tabs; identity-service may add
   * methods, which the web application skips when it does not know them.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly methods: readonly string[];

  /**
   * Property securityKeys
   *
   * @description
   * The keys of the account, by name.
   *
   * @type {readonly { readonly name: string }[]}
   * @readonly
   */
  readonly securityKeys: readonly { readonly name: string }[];

  /**
   * Property backupCodesRemaining
   *
   * @description
   * Backup codes not used yet.
   *
   * @type {number}
   * @readonly
   */
  readonly backupCodesRemaining: number;

  /**
   * Property lockedUntil
   *
   * @description
   * When the lockout of the two-step answers of the account ends, `null` without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly lockedUntil: string | null;
  // #endregion
}
