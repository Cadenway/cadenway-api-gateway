import type { InvitationRegistry } from '../../../application/ports/outbound/organization-service/invitations/invitation-registry.port.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';

/**
 * Function createInvitationRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of organization-service.
 *
 * @param {OrganizationServiceClient} client - Technical HTTP client for organization-service.
 * @returns {InvitationRegistry} Local adapter for the capability.
 */
export function createInvitationRegistryAdapter(
  client: OrganizationServiceClient,
): InvitationRegistry {
  return {
    inviteMembers: (batch) => client.inviteMembers({ emails: [...batch.emails], role: batch.role }),
    inviteMembersKeyed: (batch, idempotencyKey) =>
      client.inviteMembersKeyed({ emails: [...batch.emails], role: batch.role }, idempotencyKey),
    getInvitation: (invitationId) => client.getInvitation(invitationId),
    listInvitations: (page) => client.listInvitations({ ...page }),
    revokeInvitation: (invitationId) => client.revokeInvitation(invitationId),
    resendInvitation: (invitationId) => client.resendInvitation(invitationId),
    listReceivedInvitations: (userId, page) => client.listReceivedInvitations(userId, { ...page }),
    acceptInvitation: (userId, invitationId) => client.acceptInvitation(userId, invitationId),
    refuseInvitation: (userId, invitationId) => client.refuseInvitation(userId, invitationId),
  };
}
