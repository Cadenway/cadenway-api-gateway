import type { IdentityUsers } from '../../../application/ports/outbound/identity/me/identity-users.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createIdentityUsersAdapter
 *
 * @description
 * Binds the local port to the validating technical client. Each internal body is rebuilt member by
 * member, so that only the members of the internal contract travel; the account and the session
 * are the ones the introspection returned.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {IdentityUsers} Local adapter for the capability.
 */
export function createIdentityUsersAdapter(client: IdentityServiceClient): IdentityUsers {
  return {
    getUser: (userId) => client.getUser(userId),
    updateUser: (userId, changes, ifMatch) => client.updateUser(userId, changes, ifMatch),
    changePassword: (change) =>
      client.changePassword(change.userId, {
        sessionId: change.sessionId,
        currentPassword: change.currentPassword,
        newPassword: change.newPassword,
        client: { ipAddress: change.client.ipAddress, userAgent: change.client.userAgent },
      }),
    requestEmailChange: (request) =>
      client.requestEmailChange(request.userId, {
        sessionId: request.sessionId,
        email: request.email,
      }),
    confirmEmailChange: (confirmation) =>
      client.confirmEmailChange(confirmation.userId, {
        sessionId: confirmation.sessionId,
        code: confirmation.code,
        client: {
          ipAddress: confirmation.client.ipAddress,
          userAgent: confirmation.client.userAgent,
        },
      }),
    scheduleAccountDeletion: (request) =>
      client.scheduleAccountDeletion(request.userId, { sessionId: request.sessionId }),
  };
}
