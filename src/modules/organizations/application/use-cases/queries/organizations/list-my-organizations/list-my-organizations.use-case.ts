import type { MyOrganizationPage } from '../../../../models/organizations/my-organization-page.model.js';
import type { PageRequest } from '../../../../models/pages/page-request.model.js';
import type { OrganizationRegistry } from '../../../../ports/outbound/organization-service/organizations/organization-registry.port.js';

/**
 * Class ListMyOrganizations
 *
 * @description
 * Lists the organizations the caller belongs to, whatever the current one (the picker).
 */
export class ListMyOrganizations {
  // #region Properties
  /**
   * Property registry
   *
   * @description
   * The organizations of organization-service.
   *
   * @type {OrganizationRegistry}
   * @readonly
   */
  private readonly registry: OrganizationRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {OrganizationRegistry} registry - The organizations of organization-service.
   * @constructor
   */
  public constructor(registry: OrganizationRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads one page of the organizations of the caller.
   *
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<MyOrganizationPage>} One page of organizations.
   */
  public execute(page: PageRequest): Promise<MyOrganizationPage> {
    return this.registry.listMyOrganizations(page);
  }
  // #endregion
}
