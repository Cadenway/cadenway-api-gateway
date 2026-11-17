import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class RevokeInvitation
 *
 * @description
 * Revokes a pending invitation of the current organization through organization-service.
 */
export class RevokeInvitation {
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
   * Revokes the invitation.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<void>} Resolves once the invitation is revoked, or was already.
   */
  public execute(invitationId: string): Promise<void> {
    return this.registry.revokeInvitation(invitationId);
  }
  // #endregion
}
