import type { SecurityKey } from './security-key.model.js';
import type { TwoStepRequirement } from './two-step-requirement.model.js';

/**
 * Interface TwoStepVerification
 *
 * @description
 * The two-step verification of the account, without any secret.
 */
export interface TwoStepVerification {
  // #region Properties
  /**
   * Property enabled
   *
   * @description
   * On while the account has an authenticator app.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;

  /**
   * Property primaryMethod
   *
   * @description
   * The method a challenge opens on, `null` while off.
   *
   * @type {string | null}
   * @readonly
   */
  readonly primaryMethod: string | null;

  /**
   * Property methods
   *
   * @description
   * The configured methods; empty while off.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly methods: readonly string[];

  /**
   * Property authenticatorApp
   *
   * @description
   * The authenticator app, `null` while off.
   *
   * @type {{ readonly configuredAt: string } | null}
   * @readonly
   */
  readonly authenticatorApp: { readonly configuredAt: string } | null;

  /**
   * Property securityKeys
   *
   * @description
   * The security keys, the oldest first.
   *
   * @type {readonly SecurityKey[]}
   * @readonly
   */
  readonly securityKeys: readonly SecurityKey[];

  /**
   * Property backupCodes
   *
   * @description
   * The backup codes left, `null` while off.
   *
   * @type {{ readonly remaining: number; readonly total: number; readonly generatedAt: string } | null}
   * @readonly
   */
  readonly backupCodes: {
    readonly remaining: number;
    readonly total: number;
    readonly generatedAt: string;
  } | null;

  /**
   * Property requiredBy
   *
   * @description
   * The organizations whose policy requires it of the person.
   *
   * @type {readonly TwoStepRequirement[]}
   * @readonly
   */
  readonly requiredBy: readonly TwoStepRequirement[];
  // #endregion
}
