import type {
  Member as PublicMember,
  MemberPage as PublicMemberPage,
} from '@cadenway/contracts/types/public/members';

import type { Member } from '../../../../application/models/members/member.model.js';
import type { MemberPage } from '../../../../application/models/members/member-page.model.js';

/**
 * Function toMember
 *
 * @description
 * Maps a member to `Member` of `openapi/public/members.yaml`, member by member, so that a member
 * organization-service adds later never reaches the applications before the public contract
 * declares it. `twoStepVerificationEnabled` is passed on as organization-service sends it: present
 * for the owner and the admins, absent for anyone else.
 *
 * @param {Member} member - The member.
 * @returns {PublicMember} The public member.
 */
export function toMember(member: Member): PublicMember {
  return {
    id: member.id,
    userId: member.userId,
    name: member.name,
    email: member.email,
    role: member.role,
    joinedAt: member.joinedAt,
    version: member.version,
    ...(member.twoStepVerificationEnabled === undefined
      ? {}
      : { twoStepVerificationEnabled: member.twoStepVerificationEnabled }),
  };
}

/**
 * Function toMemberPage
 *
 * @description
 * Maps a page of members to `MemberPage`, member by member.
 *
 * @param {MemberPage} page - The page.
 * @returns {PublicMemberPage} The public page.
 */
export function toMemberPage(page: MemberPage): PublicMemberPage {
  return {
    items: page.items.map(toMember),
    nextCursor: page.nextCursor,
    total: page.total,
    counts: {
      owner: page.counts.owner,
      admin: page.counts.admin,
      member: page.counts.member,
      guest: page.counts.guest,
    },
  };
}
