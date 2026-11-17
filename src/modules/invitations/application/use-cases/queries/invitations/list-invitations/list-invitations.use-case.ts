import type { InvitationPage } from '../../../../models/invitations/invitation-page.model.js';
import type { PageRequest } from '../../../../models/pages/page-request.model.js';
import type { InvitationRegistry } from '../../../../ports/outbound/organization-service/invitations/invitation-registry.port.js';

/**
 * Class ListInvitations
 *
 * @description
 * Lists the pending invitations of the current organization, the expired ones included.
 */
export class ListInvitations {
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
   * Reads one page of the pending invitations.
   *
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<InvitationPage>} One page of invitations, with their total.
   */
  public execute(page: PageRequest): Promise<InvitationPage> {
    return this.registry.listInvitations(page);
  }
  // #endregion
}
