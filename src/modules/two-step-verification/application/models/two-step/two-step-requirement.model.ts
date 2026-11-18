/**
 * Interface TwoStepRequirement
 *
 * @description
 * An organization whose authentication policy requires two-step verification of the person.
 */
export interface TwoStepRequirement {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Id of the organization (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property requiredFor
   *
   * @description
   * `admins` or `everyone` today; identity-service may add values.
   *
   * @type {string}
   * @readonly
   */
  readonly requiredFor: string;
  // #endregion
}
