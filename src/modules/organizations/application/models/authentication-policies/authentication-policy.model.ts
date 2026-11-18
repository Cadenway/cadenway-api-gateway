/**
 * Interface AuthenticationPolicy
 *
 * @description
 * The authentication policy of an organization, kept and applied by identity-service.
 */
export interface AuthenticationPolicy {
  // #region Properties
  /**
   * Property twoStepVerificationRequiredFor
   *
   * @description
   * Who must have two-step verification: `nobody`, `admins` or `everyone` today; identity-service may add values.
   *
   * @type {string}
   * @readonly
   */
  readonly twoStepVerificationRequiredFor: string;

  /**
   * Property sessionInactivityTimeoutMinutes
   *
   * @description
   * Minutes of inactivity after which the sessions acting on the organization close.
   *
   * @type {number}
   * @readonly
   */
  readonly sessionInactivityTimeoutMinutes: number;

  /**
   * Property membersWithoutTwoStepVerification
   *
   * @description
   * Members without two-step verification: the owner and the admins among them, and all of them.
   *
   * @type {{ readonly admins: number; readonly everyone: number }}
   * @readonly
   */
  readonly membersWithoutTwoStepVerification: {
    readonly admins: number;
    readonly everyone: number;
  };

  /**
   * Property version
   *
   * @description
   * Version of the policy, also sent as `ETag`.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
