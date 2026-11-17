import type { AcceptInvitationInput } from './accept-invitation.input.js';
import type { JoinedOrganization } from '../../../../models/received/joined-organization.model.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class AcceptInvitation
 *
 * @description
 * Accepts an invitation addressed to the caller through organization-service, which checks the verified address and the state of the invitation. The session does not move to the organization.
 */
export class AcceptInvitation {
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
   * Accepts the invitation.
   *
   * @param {AcceptInvitationInput} input - The caller and the invitation.
   * @returns {Promise<JoinedOrganization>} The organization joined.
   */
  public execute(input: AcceptInvitationInput): Promise<JoinedOrganization> {
    return this.registry.acceptInvitation(input.userId, input.invitationId);
  }
  // #endregion
}
