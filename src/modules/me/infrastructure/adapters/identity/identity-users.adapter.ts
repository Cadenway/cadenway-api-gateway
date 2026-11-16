import type { IdentityUsers } from '../../../application/ports/outbound/identity/me/identity-users.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createIdentityUsersAdapter
 *
 * @description
 * Binds the local port to the validating technical client.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {IdentityUsers} Local adapter for the capability.
 */
export function createIdentityUsersAdapter(client: IdentityServiceClient): IdentityUsers {
  return {
    getUser: (userId) => client.getUser(userId),
  };
}
