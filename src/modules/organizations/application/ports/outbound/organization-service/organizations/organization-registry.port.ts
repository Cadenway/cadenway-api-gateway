import type { CreateOrganizationInput } from '../../../../use-cases/commands/organizations/create-organization/create-organization.input.js';
import type { CreateOrganizationOutput } from '../../../../use-cases/commands/organizations/create-organization/create-organization.output.js';
import type { MyOrganizationPage } from '../../../../models/organizations/my-organization-page.model.js';
import type { Organization } from '../../../../models/organizations/organization.model.js';
import type { OrganizationChanges } from '../../../../models/organizations/organization-changes.model.js';
import type { PageRequest } from '../../../../models/pages/page-request.model.js';

/**
 * Interface OrganizationRegistry
 *
 * @description
 * Outgoing port of the organization routes: the organizations of organization-service, called as
 * the user of the current organization context. organization-service decides every role rule.
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of organization-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface OrganizationRegistry {
  // #region Methods
  /**
   * Method createOrganization
   *
   * @description
   * `POST /internal/v1/organizations`.
   *
   * @param {CreateOrganizationInput} creation - The organization to create.
   * @returns {Promise<CreateOrganizationOutput>} The organization and its invitations.
   */
  createOrganization(creation: CreateOrganizationInput): Promise<CreateOrganizationOutput>;

  /**
   * Method listMyOrganizations
   *
   * @description
   * `GET /internal/v1/organizations`.
   *
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<MyOrganizationPage>} One page of the organizations of the caller.
   */
  listMyOrganizations(page: PageRequest): Promise<MyOrganizationPage>;

  /**
   * Method getCurrentOrganization
   *
   * @description
   * `GET /internal/v1/organization`, the organization of the context.
   *
   * @returns {Promise<Organization>} The organization.
   */
  getCurrentOrganization(): Promise<Organization>;

  /**
   * Method updateCurrentOrganization
   *
   * @description
   * `PATCH /internal/v1/organization`, with the `If-Match` of the public request.
   *
   * @param {OrganizationChanges} changes - JSON Merge Patch of the organization.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<Organization>} The organization after the change.
   */
  updateCurrentOrganization(
    changes: OrganizationChanges,
    ifMatch: string | undefined,
  ): Promise<Organization>;
  // #endregion
}
