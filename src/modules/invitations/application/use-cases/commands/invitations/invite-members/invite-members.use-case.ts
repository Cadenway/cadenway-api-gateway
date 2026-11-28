import type { InviteMembersInput } from './invite-members.input.js';
import type { InviteMembersOutput } from './invite-members.output.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class InviteMembers
 *
 * @description
 * Invites a batch of addresses to the current organization through organization-service, which decides who may and answers each address on its own.
 */
export class InviteMembers {
  // #region Properties
  /**
   * Property registry
   *
   * @description
   * The invitations of organization-service.
   *
   * @type {InvitationRegistry}
   * @readonly
   */
  private readonly registry: InvitationRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {InvitationRegistry} registry - The invitations of organization-service.
   * @constructor
   */
  public constructor(registry: InvitationRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Invites the addresses. A batch with an `Idempotency-Key` goes to the keyed invitation of
   * organization-service, which replays it; one without keeps the plain invitation. A key is
   * never dropped and never sent to the plain invitation.
   *
   * @param {InviteMembersInput} input - The addresses, their role and the optional key.
   * @returns {Promise<InviteMembersOutput>} The outcome of each distinct address.
   */
  public execute(input: InviteMembersInput): Promise<InviteMembersOutput> {
    const batch = { emails: input.emails, role: input.role };
    return input.idempotencyKey === undefined
      ? this.registry.inviteMembers(batch)
      : this.registry.inviteMembersKeyed(batch, input.idempotencyKey);
  }
  // #endregion
}
