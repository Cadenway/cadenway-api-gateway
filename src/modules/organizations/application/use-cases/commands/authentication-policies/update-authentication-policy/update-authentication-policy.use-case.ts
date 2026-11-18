import type { UpdateAuthenticationPolicyInput } from './update-authentication-policy.input.js';
import type { AuthenticationPolicy } from '../../../../models/authentication-policies/authentication-policy.model.js';
import type { AuthenticationPolicies } from '../../../../ports/outbound/identity/authentication-policies/authentication-policies.port.js';

/**
 * Class UpdateAuthenticationPolicy
 *
 * @description
 * Changes the authentication policy of the current organization; identity-service checks the role, the version, the two-step verification of the caller and the recent authentication of the session.
 */
export class UpdateAuthenticationPolicy {
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
   * Changes the policy.
   *
   * @param {UpdateAuthenticationPolicyInput} input - The session, the patch and `If-Match`.
   * @returns {Promise<AuthenticationPolicy>} The policy after the change.
   */
  public execute(input: UpdateAuthenticationPolicyInput): Promise<AuthenticationPolicy> {
    return this.policies.updateAuthenticationPolicy(input);
  }
  // #endregion
}
