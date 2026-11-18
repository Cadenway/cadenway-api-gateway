import type { BackupCodes } from './backup-codes.model.js';
import type { TwoStepVerification } from './two-step-verification.model.js';

/**
 * Interface AuthenticatorAppConfigured
 *
 * @description
 * An authenticator app confirmed: the two-step verification of the account, and its backup codes when two-step verification just turned on.
 */
export interface AuthenticatorAppConfigured {
  // #region Properties
  /**
   * Property twoStepVerification
   *
   * @description
   * The two-step verification after the change.
   *
   * @type {TwoStepVerification}
   * @readonly
   */
  readonly twoStepVerification: TwoStepVerification;

  /**
   * Property backupCodes
   *
   * @description
   * The 10 new backup codes, returned once; `null` for a reconfiguration.
   *
   * @type {BackupCodes | null}
   * @readonly
   */
  readonly backupCodes: BackupCodes | null;
  // #endregion
}
