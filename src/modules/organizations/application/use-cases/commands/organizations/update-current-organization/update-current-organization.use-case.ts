import type { UpdateCurrentOrganizationInput } from './update-current-organization.input.js';
import type { Organization } from '../../../../models/organizations/organization.model.js';
import type { OrganizationRegistry } from '../../../../ports/outbound/organization-service/organizations/organization-registry.port.js';

/**
 * Class UpdateCurrentOrganization
 *
 * @description
 * Changes the current organization through organization-service, which checks the role of the caller and the version.
 */
export class UpdateCurrentOrganization {
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
   * Applies the change to the organization of the organization context.
   *
   * @param {UpdateCurrentOrganizationInput} input - The changes and `If-Match`.
   * @returns {Promise<Organization>} The organization after the change.
   */
  public execute(input: UpdateCurrentOrganizationInput): Promise<Organization> {
    return this.registry.updateCurrentOrganization(input.changes, input.ifMatch);
  }
  // #endregion
}
