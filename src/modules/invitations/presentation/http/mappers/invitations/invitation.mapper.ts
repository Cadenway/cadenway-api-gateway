import type {
  Invitation as PublicInvitation,
  InvitationBatchResult,
  InvitationPage as PublicInvitationPage,
} from '@cadenway/contracts/types/public/members';

import type { Invitation } from '../../../../application/models/invitations/invitation.model.js';
import type { InvitationPage } from '../../../../application/models/invitations/invitation-page.model.js';
import type { InviteMembersOutput } from '../../../../application/use-cases/commands/invitations/invite-members/invite-members.output.js';

/**
 * Function toInvitation
 *
 * @description
 * Maps an invitation to `Invitation` of `openapi/public/members.yaml`, member by member.
 *
 * @param {Invitation} invitation - The invitation.
 * @returns {PublicInvitation} The public invitation.
 */
export function toInvitation(invitation: Invitation): PublicInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    invitedBy: { userId: invitation.invitedBy.userId, name: invitation.invitedBy.name },
    status: invitation.status,
    sentAt: invitation.sentAt,
    expiresAt: invitation.expiresAt,
    version: invitation.version,
  };
}

/**
 * Function toInvitationPage
 *
 * @description
 * Maps a page of pending invitations to `InvitationPage`, member by member.
 *
 * @param {InvitationPage} page - The page.
 * @returns {PublicInvitationPage} The public page.
 */
export function toInvitationPage(page: InvitationPage): PublicInvitationPage {
  return {
    items: page.items.map(toInvitation),
    nextCursor: page.nextCursor,
    total: page.total,
  };
}

/**
 * Function toInvitationBatchResult
 *
 * @description
 * Maps the outcomes of a batch to `InvitationBatchResult`, member by member.
 *
 * @param {InviteMembersOutput} result - The outcome of each address.
 * @returns {InvitationBatchResult} The public answer.
 */
export function toInvitationBatchResult(result: InviteMembersOutput): InvitationBatchResult {
  return {
    invitations: result.invitations.map((invitation) => ({
      email: invitation.email,
      outcome: invitation.outcome,
      invitationId: invitation.invitationId,
    })),
  };
}
