import type { InvitationState } from '../../../../models/invitations/invitation-state.model.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class GetInvitation
 *
 * @description
 * Reads one invitation of the current organization in any state through organization-service,
 * which decides who may read it (owner and admins).
 */
export class GetInvitation {
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
   * Reads the invitation.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<InvitationState>} The invitation and its current state.
   */
  public execute(invitationId: string): Promise<InvitationState> {
    return this.registry.getInvitation(invitationId);
  }
  // #endregion
}
