import type { SessionRegistry } from '../../../application/ports/outbound/identity/sessions/session-registry.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createSessionRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of identity-service. The session of the
 * request travels as `currentSessionId` in the query of the list, and in the path of the
 * revocation of the others.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {SessionRegistry} Local adapter for the capability.
 */
export function createSessionRegistryAdapter(client: IdentityServiceClient): SessionRegistry {
  return {
    listSessions: (request) =>
      client.listUserSessions(request.userId, {
        currentSessionId: request.currentSessionId,
        ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
        limit: request.limit,
      }),
    revokeSession: (sessionId) => client.revokeSession(sessionId),
    revokeOtherSessions: (sessionId) => client.revokeOtherSessions(sessionId),
  };
}
