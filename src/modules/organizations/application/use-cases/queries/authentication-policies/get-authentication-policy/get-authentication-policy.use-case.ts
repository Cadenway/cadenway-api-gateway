import type { AuthenticationPolicy } from '../../../../models/authentication-policies/authentication-policy.model.js';
import type { AuthenticationPolicies } from '../../../../ports/outbound/identity/authentication-policies/authentication-policies.port.js';

/**
 * Class GetAuthenticationPolicy
 *
 * @description
 * Reads the authentication policy of the current organization, the one of the internal token.
 */
export class GetAuthenticationPolicy {
  // #region Properties
  /**
   * Property policies
   *
   * @description
   * The authentication policies of identity-service.
   *
   * @type {AuthenticationPolicies}
   * @readonly
   */
  private readonly policies: AuthenticationPolicies;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {AuthenticationPolicies} policies - The authentication policies of identity-service.
   * @constructor
   */
  public constructor(policies: AuthenticationPolicies) {
    this.policies = policies;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the policy.
   *
   * @returns {Promise<AuthenticationPolicy>} The policy.
   */
  public execute(): Promise<AuthenticationPolicy> {
    return this.policies.getAuthenticationPolicy();
  }
  // #endregion
}
