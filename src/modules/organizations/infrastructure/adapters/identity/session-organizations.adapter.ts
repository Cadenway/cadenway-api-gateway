import type { SessionOrganizations } from '../../../application/ports/outbound/identity/sessions/session-organizations.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createSessionOrganizationsAdapter
 *
 * @description
 * Binds the local port to the validating technical client of identity-service.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {SessionOrganizations} Local adapter for the capability.
 */
export function createSessionOrganizationsAdapter(
  client: IdentityServiceClient,
): SessionOrganizations {
  return {
    switchOrganization: (sessionId, organizationId) =>
      client.switchSessionOrganization(sessionId, organizationId),
  };
}
