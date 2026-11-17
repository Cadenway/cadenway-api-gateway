import type {
  JoinedOrganization as PublicJoinedOrganization,
  ReceivedInvitationPage as PublicReceivedInvitationPage,
} from '@cadenway/contracts/types/public/members';

import type { JoinedOrganization } from '../../../../application/models/received/joined-organization.model.js';
import type { ReceivedInvitation } from '../../../../application/models/received/received-invitation.model.js';
import type { ReceivedInvitationPage } from '../../../../application/models/received/received-invitation-page.model.js';

/**
 * Function toReceivedInvitationPage
 *
 * @description
 * Maps a page of the invitations addressed to the caller to `ReceivedInvitationPage` of
 * `openapi/public/members.yaml`, member by member.
 *
 * @param {ReceivedInvitationPage} page - The page.
 * @returns {PublicReceivedInvitationPage} The public page.
 */
export function toReceivedInvitationPage(
  page: ReceivedInvitationPage,
): PublicReceivedInvitationPage {
  return {
    items: page.items.map((invitation: ReceivedInvitation) => ({
      id: invitation.id,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
        description: invitation.organization.description,
        memberCount: invitation.organization.memberCount,
      },
      role: invitation.role,
      invitedBy: { userId: invitation.invitedBy.userId, name: invitation.invitedBy.name },
      expiresAt: invitation.expiresAt,
    })),
    nextCursor: page.nextCursor,
  };
}

/**
 * Function toJoinedOrganization
 *
 * @description
 * Maps the organization the caller joined to `JoinedOrganization`, member by member.
 *
 * @param {JoinedOrganization} joined - The organization.
 * @returns {PublicJoinedOrganization} The public answer.
 */
export function toJoinedOrganization(joined: JoinedOrganization): PublicJoinedOrganization {
  return {
    id: joined.id,
    name: joined.name,
    slug: joined.slug,
    role: joined.role,
    memberCount: joined.memberCount,
    plan: joined.plan,
    joinedAt: joined.joinedAt,
  };
}
