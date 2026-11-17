import type { RefuseInvitationInput } from './refuse-invitation.input.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class RefuseInvitation
 *
 * @description
 * Refuses an invitation addressed to the caller through organization-service, with the checks of the acceptance.
 */
export class RefuseInvitation {
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
   * Refuses the invitation.
   *
   * @param {RefuseInvitationInput} input - The caller and the invitation.
   * @returns {Promise<void>} Resolves once the invitation is refused.
   */
  public execute(input: RefuseInvitationInput): Promise<void> {
    return this.registry.refuseInvitation(input.userId, input.invitationId);
  }
  // #endregion
}
