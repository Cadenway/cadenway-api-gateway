import type { MemberDirectory } from '../../../application/ports/outbound/organization-service/members/member-directory.port.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';

/**
 * Function createMemberDirectoryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of organization-service, mapping the
 * filters of a list to the internal query member by member.
 *
 * @param {OrganizationServiceClient} client - Technical HTTP client for organization-service.
 * @returns {MemberDirectory} Local adapter for the capability.
 */
export function createMemberDirectoryAdapter(client: OrganizationServiceClient): MemberDirectory {
  return {
    listMembers: (query, method) => {
      const input = {
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        limit: query.limit,
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.roles === undefined ? {} : { role: [...query.roles] }),
      };
      return method === 'QUERY' ? client.queryListMembers(input) : client.listMembers(input);
    },
    getMember: (memberId) => client.getMember(memberId),
    changeMemberRole: (memberId, role, ifMatch) =>
      client.changeMemberRole(memberId, { role }, ifMatch),
    removeMember: (memberId) => client.removeMember(memberId),
  };
}
