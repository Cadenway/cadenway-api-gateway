import type { AuthenticationPolicyChanges } from '../../../../models/authentication-policies/authentication-policy-changes.model.js';

/**
 * Interface UpdateAuthenticationPolicyInput
 *
 * @description
 * A change of the authentication policy of the current organization, from the session of the request.
 */
export interface UpdateAuthenticationPolicyInput {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * Id of the session (a UUID), as the introspection returned it, whose recent authentication identity-service checks.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property changes
   *
   * @description
   * The JSON Merge Patch of the policy.
   *
   * @type {AuthenticationPolicyChanges}
   * @readonly
   */
  readonly changes: AuthenticationPolicyChanges;

  /**
   * Property ifMatch
   *
   * @description
   * `If-Match` of the public request, relayed unchanged.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly ifMatch: string | undefined;
  // #endregion
}
