import type { ApiTokenIntrospector } from '../../../application/ports/outbound/identity/api-token/api-token-introspector.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createApiTokenIntrospectorAdapter
 *
 * @description
 * Binds the local port to the validating technical client.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {ApiTokenIntrospector} Local adapter for the capability.
 */
export function createApiTokenIntrospectorAdapter(
  client: IdentityServiceClient,
): ApiTokenIntrospector {
  return {
    introspect: (token) => client.introspectApiToken(token),
  };
}
