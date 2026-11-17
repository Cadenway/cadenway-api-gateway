import type { CreateOrganizationInput } from './create-organization.input.js';
import type { CreateOrganizationOutput } from './create-organization.output.js';
import type { OrganizationRegistry } from '../../../../ports/outbound/organization-service/organizations/organization-registry.port.js';

/**
 * Class CreateOrganization
 *
 * @description
 * Creates an organization owned by the caller, with its invitations, through organization-service. The session does not move to it.
 */
export class CreateOrganization {
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
   * Creates the organization.
   *
   * @param {CreateOrganizationInput} input - The organization to create.
   * @returns {Promise<CreateOrganizationOutput>} The organization and the outcome of each address.
   */
  public execute(input: CreateOrganizationInput): Promise<CreateOrganizationOutput> {
    return this.registry.createOrganization(input);
  }
  // #endregion
}
