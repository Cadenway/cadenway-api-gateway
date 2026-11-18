/**
 * Interface AuthenticationPolicyChanges
 *
 * @description
 * A JSON Merge Patch of the authentication policy: a member left out is unchanged.
 */
export interface AuthenticationPolicyChanges {
  // #region Properties
  /**
   * Property twoStepVerificationRequiredFor
   *
   * @description
   * Who must have two-step verification.
   *
   * @type {'nobody' | 'admins' | 'everyone' | undefined}
   * @readonly
   */
  readonly twoStepVerificationRequiredFor?: 'nobody' | 'admins' | 'everyone';

  /**
   * Property sessionInactivityTimeoutMinutes
   *
   * @description
   * Minutes of inactivity after which the sessions close.
   *
   * @type {60 | 720 | 10080 | 43200 | undefined}
   * @readonly
   */
  readonly sessionInactivityTimeoutMinutes?: 60 | 720 | 10080 | 43200;
  // #endregion
}
