import type { ApiTokenRegistry } from '../../../application/ports/outbound/identity/api-tokens/api-token-registry.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createApiTokenRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of identity-service.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {ApiTokenRegistry} Local adapter for the capability.
 */
export function createApiTokenRegistryAdapter(client: IdentityServiceClient): ApiTokenRegistry {
  return {
    createApiToken: (creation) =>
      client.createApiToken({
        name: creation.name,
        scopes: [...creation.scopes],
        expiration: creation.expiration,
      }),
    listApiTokens: (page) => client.listApiTokens({ ...page }),
    revokeApiToken: (apiTokenId) => client.revokeApiToken(apiTokenId),
  };
}
