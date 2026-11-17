import type { Organization } from '../../../../models/organizations/organization.model.js';
import type { OrganizationRegistry } from '../../../../ports/outbound/organization-service/organizations/organization-registry.port.js';

/**
 * Class GetCurrentOrganization
 *
 * @description
 * Reads the current organization of the request, with the role of the caller in it.
 */
export class GetCurrentOrganization {
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
   * Reads the organization of the organization context of the request.
   *
   * @returns {Promise<Organization>} The current organization.
   */
  public execute(): Promise<Organization> {
    return this.registry.getCurrentOrganization();
  }
  // #endregion
}
