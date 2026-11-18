import type { AuthenticationPolicies } from '../../../application/ports/outbound/identity/authentication-policies/authentication-policies.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createAuthenticationPoliciesAdapter
 *
 * @description
 * Binds the local port to the validating technical client of identity-service. The patch is
 * rebuilt member by member, the session of the request travels in the query (`sessionId`) and
 * `If-Match` is relayed unchanged.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {AuthenticationPolicies} Local adapter for the capability.
 */
export function createAuthenticationPoliciesAdapter(
  client: IdentityServiceClient,
): AuthenticationPolicies {
  return {
    getAuthenticationPolicy: () => client.getAuthenticationPolicy(),
    updateAuthenticationPolicy: (request) =>
      client.updateAuthenticationPolicy(
        request.sessionId,
        {
          ...(request.changes.twoStepVerificationRequiredFor === undefined
            ? {}
            : { twoStepVerificationRequiredFor: request.changes.twoStepVerificationRequiredFor }),
          ...(request.changes.sessionInactivityTimeoutMinutes === undefined
            ? {}
            : { sessionInactivityTimeoutMinutes: request.changes.sessionInactivityTimeoutMinutes }),
        },
        request.ifMatch,
      ),
  };
}
