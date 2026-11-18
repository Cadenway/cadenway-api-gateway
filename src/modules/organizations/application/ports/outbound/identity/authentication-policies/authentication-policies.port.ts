import type { AuthenticationPolicy } from '../../../../models/authentication-policies/authentication-policy.model.js';
import type { UpdateAuthenticationPolicyInput } from '../../../../use-cases/commands/authentication-policies/update-authentication-policy/update-authentication-policy.input.js';

/**
 * Interface AuthenticationPolicies
 *
 * @description
 * Outgoing port of `GET` and `PATCH /v1/organization/authentication-policy`: the authentication
 * policy identity-service keeps and applies for the organization of the internal token, the
 * current organization of the session, called as its user. identity-service decides who may read
 * and change it, from its copy of the memberships.
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of identity-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface AuthenticationPolicies {
  // #region Methods
  /**
   * Method getAuthenticationPolicy
   *
   * @description
   * `GET /internal/v1/organization/authentication-policy`. Rejects with
   * `403 organization.role-forbidden` or `404 organization.not-found`.
   *
   * @returns {Promise<AuthenticationPolicy>} The policy.
   */
  getAuthenticationPolicy(): Promise<AuthenticationPolicy>;

  /**
   * Method updateAuthenticationPolicy
   *
   * @description
   * `PATCH /internal/v1/organization/authentication-policy?sessionId=`, with `If-Match`. Rejects
   * with `403 organization.role-forbidden`, `404 organization.not-found`,
   * `412 request.version-mismatch`, `409 auth.two-step-not-enabled`,
   * `403 auth.reauthentication-required`, or `404 session.not-found` when the session is no
   * longer an open session of the user.
   *
   * @param {UpdateAuthenticationPolicyInput} request - Session of the request, patch and
   * `If-Match`.
   * @returns {Promise<AuthenticationPolicy>} The policy after the change.
   */
  updateAuthenticationPolicy(
    request: UpdateAuthenticationPolicyInput,
  ): Promise<AuthenticationPolicy>;
  // #endregion
}
