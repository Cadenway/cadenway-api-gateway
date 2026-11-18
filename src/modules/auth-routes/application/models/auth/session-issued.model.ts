/**
 * Interface SessionIssued
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface SessionIssued {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * Opaque token returned once, kept out of logs.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property session
   *
   * @description
   * Identifier and lifetime of the issued session.
   *
   * @type {{ readonly id: string; readonly expiresAt: string; readonly persistent: boolean }}
   * @readonly
   */
  readonly session: {
    readonly id: string;
    readonly expiresAt: string;
    readonly persistent: boolean;
  };

  /**
   * Property user
   *
   * @description
   * Account returned with the session.
   *
   * @type {{ readonly id: string; readonly name: string; readonly email: string; readonly language: string; readonly version: number }}
   * @readonly
   */
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly language: string;
    readonly displayName?: string | null;
    readonly jobTitle?: string | null;
    readonly timeZone?: string;
    readonly passwordChangedAt?: string;
    readonly version: number;
  };

  /**
   * Property deletionCancelled
   *
   * @description
   * `true` when this sign-in cancelled the scheduled deletion of the account; absent or `false`
   * otherwise.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly deletionCancelled?: boolean;

  /**
   * Property trustedDevice
   *
   * @description
   * The device an answer of a two-step challenge with `trustDevice` made trusted: its opaque
   * token, returned once and written into the device cookie only, and when it expires. Absent
   * otherwise.
   *
   * @type {{ readonly token: string; readonly expiresAt: string } | undefined}
   * @readonly
   */
  readonly trustedDevice?: { readonly token: string; readonly expiresAt: string };
  // #endregion
}
