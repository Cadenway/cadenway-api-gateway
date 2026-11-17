import type { InvitationOutcome } from '../../../../models/organizations/invitation-outcome.model.js';
import type { Organization } from '../../../../models/organizations/organization.model.js';

/**
 * Interface CreateOrganizationOutput
 *
 * @description
 * The organization created, and what became of each distinct address invited with it.
 */
export interface CreateOrganizationOutput {
  // #region Properties
  /**
   * Property organization
   *
   * @description
   * The organization, of which the caller is the owner.
   *
   * @type {Organization}
   * @readonly
   */
  readonly organization: Organization;

  /**
   * Property invitations
   *
   * @description
   * One outcome per distinct address, in their order.
   *
   * @type {readonly InvitationOutcome[]}
   * @readonly
   */
  readonly invitations: readonly InvitationOutcome[];
  // #endregion
}
