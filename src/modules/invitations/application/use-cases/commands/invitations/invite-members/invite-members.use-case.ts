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
   * Invites the addresses.
   *
   * @param {InviteMembersInput} input - The addresses and their role.
   * @returns {Promise<InviteMembersOutput>} The outcome of each distinct address.
   */
  public execute(input: InviteMembersInput): Promise<InviteMembersOutput> {
    return this.registry.inviteMembers(input);
  }
  // #endregion
}
