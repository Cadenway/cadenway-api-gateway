import type { InviteMembersInput } from '../../../../use-cases/commands/invitations/invite-members/invite-members.input.js';
import type { InviteMembersOutput } from '../../../../use-cases/commands/invitations/invite-members/invite-members.output.js';
import type { Invitation } from '../../../../models/invitations/invitation.model.js';
import type { InvitationPage } from '../../../../models/invitations/invitation-page.model.js';
import type { InvitationState } from '../../../../models/invitations/invitation-state.model.js';
import type { PageRequest } from '../../../../models/pages/page-request.model.js';
import type { JoinedOrganization } from '../../../../models/received/joined-organization.model.js';
import type { ReceivedInvitationPage } from '../../../../models/received/received-invitation-page.model.js';

/**
 * Interface InvitationRegistry
 *
 * @description
 * Outgoing port of the invitation routes: the invitations of organization-service, called as the
 * user of the current organization context. The routes of the current organization act on the
 * organization of the internal token; the routes of the invitee name the user the introspection
 * returned. organization-service decides every rule (roles, verified address, state).
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of organization-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface InvitationRegistry {
  // #region Methods
  /**
   * Method inviteMembers
   *
   * @description
   * `POST /internal/v1/invitations`.
   *
   * @param {InviteMembersInput} batch - The addresses and their role.
   * @returns {Promise<InviteMembersOutput>} The outcome of each distinct address.
   */
  inviteMembers(batch: InviteMembersInput): Promise<InviteMembersOutput>;

  /**
   * Method inviteMembersKeyed
   *
   * @description
   * `POST /internal/v1/invitation-batches`, with the `Idempotency-Key` relayed unchanged.
   * Rejects with `503 upstream.unavailable` and a retry delay when the serving release of
   * organization-service cannot replay keyed batches yet; nothing ran then.
   *
   * @param {InviteMembersInput} batch - The addresses and their role.
   * @param {string} idempotencyKey - `Idempotency-Key` of the request.
   * @returns {Promise<InviteMembersOutput>} The outcome of each distinct address, replayed for
   * an equivalent request with the same key.
   */
  inviteMembersKeyed(
    batch: InviteMembersInput,
    idempotencyKey: string,
  ): Promise<InviteMembersOutput>;

  /**
   * Method getInvitation
   *
   * @description
   * `GET /internal/v1/invitations/{invitationId}`.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<InvitationState>} The invitation in any state.
   */
  getInvitation(invitationId: string): Promise<InvitationState>;

  /**
   * Method listInvitations
   *
   * @description
   * `GET /internal/v1/invitations`.
   *
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<InvitationPage>} One page of pending invitations.
   */
  listInvitations(page: PageRequest): Promise<InvitationPage>;

  /**
   * Method revokeInvitation
   *
   * @description
   * `DELETE /internal/v1/invitations/{invitationId}`.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<void>} Resolves once the invitation is revoked.
   */
  revokeInvitation(invitationId: string): Promise<void>;

  /**
   * Method resendInvitation
   *
   * @description
   * `POST /internal/v1/invitations/{invitationId}/resend`.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<Invitation>} The invitation, with its new expiry.
   */
  resendInvitation(invitationId: string): Promise<Invitation>;

  /**
   * Method listReceivedInvitations
   *
   * @description
   * `GET /internal/v1/users/{userId}/invitations`.
   *
   * @param {string} userId - Id of the account of the session.
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<ReceivedInvitationPage>} One page of invitations addressed to the caller.
   */
  listReceivedInvitations(userId: string, page: PageRequest): Promise<ReceivedInvitationPage>;

  /**
   * Method acceptInvitation
   *
   * @description
   * `POST /internal/v1/users/{userId}/invitations/{invitationId}/accept`.
   *
   * @param {string} userId - Id of the account of the session.
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<JoinedOrganization>} The organization joined.
   */
  acceptInvitation(userId: string, invitationId: string): Promise<JoinedOrganization>;

  /**
   * Method refuseInvitation
   *
   * @description
   * `POST /internal/v1/users/{userId}/invitations/{invitationId}/refuse`.
   *
   * @param {string} userId - Id of the account of the session.
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<void>} Resolves once the invitation is refused.
   */
  refuseInvitation(userId: string, invitationId: string): Promise<void>;
  // #endregion
}
