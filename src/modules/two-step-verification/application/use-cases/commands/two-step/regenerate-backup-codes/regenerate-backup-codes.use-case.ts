import type { AccountChange } from '../../../../models/two-step/account-change.model.js';
import type { BackupCodes } from '../../../../models/two-step/backup-codes.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class RegenerateBackupCodes
 *
 * @description
 * Replaces the backup codes of the account of the request with 10 new ones.
 */
export class RegenerateBackupCodes {
  // #region Properties
  /**
   * Property registry
   *
   * @description
   * The two-step verification of identity-service.
   *
   * @type {TwoStepVerificationRegistry}
   * @readonly
   */
  private readonly registry: TwoStepVerificationRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {TwoStepVerificationRegistry} registry - The two-step verification of identity-service.
   * @constructor
   */
  public constructor(registry: TwoStepVerificationRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Generates new backup codes.
   *
   * @param {AccountChange} input - The account, the session and the browser of the request.
   * @returns {Promise<BackupCodes>} The new codes, returned once.
   */
  public execute(input: AccountChange): Promise<BackupCodes> {
    return this.registry.regenerateBackupCodes(input);
  }
  // #endregion
}
