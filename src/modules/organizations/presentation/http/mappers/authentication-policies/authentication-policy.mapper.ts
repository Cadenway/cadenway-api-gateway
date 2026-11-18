import type { AuthenticationPolicy as PublicAuthenticationPolicy } from '@cadenway/contracts/types/public/organizations';

import type { AuthenticationPolicy } from '../../../../application/models/authentication-policies/authentication-policy.model.js';

/**
 * Function toAuthenticationPolicy
 *
 * @description
 * Maps the authentication policy of an organization to `AuthenticationPolicy` of
 * `openapi/public/organizations.yaml`, member by member. Its `version` becomes the `ETag` of the
 * answer (`EtagInterceptor` of `@cadenway/nest-common`).
 *
 * @param {AuthenticationPolicy} policy - The policy.
 * @returns {PublicAuthenticationPolicy} The public policy.
 */
export function toAuthenticationPolicy(policy: AuthenticationPolicy): PublicAuthenticationPolicy {
  return {
    twoStepVerificationRequiredFor: policy.twoStepVerificationRequiredFor,
    sessionInactivityTimeoutMinutes: policy.sessionInactivityTimeoutMinutes,
    membersWithoutTwoStepVerification: {
      admins: policy.membersWithoutTwoStepVerification.admins,
      everyone: policy.membersWithoutTwoStepVerification.everyone,
    },
    version: policy.version,
  };
}
