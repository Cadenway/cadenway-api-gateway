import type { Invitation } from '../../../../models/invitations/invitation.model.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class ResendInvitation
 *
 * @description
 * Sends a pending invitation of the current organization again, starting its 7 days again, through organization-service.
 */
export class ResendInvitation {
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
   * Sends the invitation again.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<Invitation>} The invitation, with its new expiry.
   */
  public execute(invitationId: string): Promise<Invitation> {
    return this.registry.resendInvitation(invitationId);
  }
  // #endregion
}
