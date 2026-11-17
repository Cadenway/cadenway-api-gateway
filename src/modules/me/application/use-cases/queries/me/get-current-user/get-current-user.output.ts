/**
 * Interface GetCurrentUserOutput
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface GetCurrentUserOutput {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Persisted account identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Display name supplied by the caller.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property language
   *
   * @description
   * Preferred account language.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /** Optional mention name during the identity-service rollout. */
  readonly displayName?: string | null;

  /** Optional job title during the identity-service rollout. */
  readonly jobTitle?: string | null;

  /** Optional IANA time zone during the identity-service rollout. */
  readonly timeZone?: string;

  /**
   * Property version
   *
   * @description
   * Persisted account version.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
