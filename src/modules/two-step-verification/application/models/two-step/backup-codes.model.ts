/**
 * Interface BackupCodes
 *
 * @description
 * Backup codes, returned once by the request that generates them. Secrets: never logged.
 */
export interface BackupCodes {
  // #region Properties
  /**
   * Property codes
   *
   * @description
   * The 10 codes `XXXX-XXXX`.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly codes: readonly string[];

  /**
   * Property generatedAt
   *
   * @description
   * When they were generated.
   *
   * @type {string}
   * @readonly
   */
  readonly generatedAt: string;
  // #endregion
}
