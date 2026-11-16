import type { SessionIntrospector } from '../../../application/ports/outbound/identity/session/session-introspector.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createSessionIntrospectorAdapter
 *
 * @description
 * Binds the local port to the validating technical client.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {SessionIntrospector} Local adapter for the capability.
 */
export function createSessionIntrospectorAdapter(
  client: IdentityServiceClient,
): SessionIntrospector {
  return {
    introspect: (token) => client.introspect(token),
  };
}
