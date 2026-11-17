import type { ListReceivedInvitationsInput } from './list-received-invitations.input.js';
import type { ReceivedInvitationPage } from '../../../../models/received/received-invitation-page.model.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class ListReceivedInvitations
 *
 * @description
 * Lists the pending invitations addressed to the verified address of the caller, from every organization.
 */
export class ListReceivedInvitations {
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
   * Reads one page of the invitations addressed to the caller.
   *
   * @param {ListReceivedInvitationsInput} input - The caller and the page.
   * @returns {Promise<ReceivedInvitationPage>} One page of invitations addressed to the caller.
   */
  public execute(input: ListReceivedInvitationsInput): Promise<ReceivedInvitationPage> {
    return this.registry.listReceivedInvitations(input.userId, input.page);
  }
  // #endregion
}
