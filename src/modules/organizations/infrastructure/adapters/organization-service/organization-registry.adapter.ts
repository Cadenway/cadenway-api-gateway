import type { OrganizationRegistry } from '../../../application/ports/outbound/organization-service/organizations/organization-registry.port.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';

/**
 * Function createOrganizationRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of organization-service, mapping the
 * creation to the internal `OrganizationCreation` member by member.
 *
 * @param {OrganizationServiceClient} client - Technical HTTP client for organization-service.
 * @returns {OrganizationRegistry} Local adapter for the capability.
 */
export function createOrganizationRegistryAdapter(
  client: OrganizationServiceClient,
): OrganizationRegistry {
  return {
    createOrganization: (creation) =>
      client.createOrganization({
        name: creation.name,
        ...(creation.slug === undefined ? {} : { slug: creation.slug }),
        teamSize: creation.teamSize,
        primaryUse: creation.primaryUse,
        inviteEmails: [...creation.inviteEmails],
      }),
    listMyOrganizations: (page) => client.listMyOrganizations({ ...page }),
    getCurrentOrganization: () => client.getOrganization(),
    updateCurrentOrganization: (changes, ifMatch) =>
      client.updateOrganization({ ...changes }, ifMatch),
  };
}
