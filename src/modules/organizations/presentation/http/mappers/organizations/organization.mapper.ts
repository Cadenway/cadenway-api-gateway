import type {
  MyOrganizationPage as PublicMyOrganizationPage,
  Organization as PublicOrganization,
  OrganizationCreated,
  SessionOrganization as PublicSessionOrganization,
} from '@cadenway/contracts/types/public/organizations';

import type { MyOrganization } from '../../../../application/models/organizations/my-organization.model.js';
import type { MyOrganizationPage } from '../../../../application/models/organizations/my-organization-page.model.js';
import type { Organization } from '../../../../application/models/organizations/organization.model.js';
import type { SessionOrganization } from '../../../../application/models/sessions/session-organization.model.js';
import type { CreateOrganizationOutput } from '../../../../application/use-cases/commands/organizations/create-organization/create-organization.output.js';

/**
 * Function toOrganization
 *
 * @description
 * Maps an organization to `Organization` of `openapi/public/organizations.yaml`, member by member,
 * so that a member organization-service adds later never reaches the applications before the
 * public contract declares it.
 *
 * @param {Organization} organization - The organization.
 * @returns {PublicOrganization} The public organization.
 */
export function toOrganization(organization: Organization): PublicOrganization {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    description: organization.description,
    website: organization.website,
    defaultLanguage: organization.defaultLanguage,
    plan: organization.plan,
    memberCount: organization.memberCount,
    role: organization.role,
    createdAt: organization.createdAt,
    version: organization.version,
  };
}

/**
 * Function toOrganizationCreated
 *
 * @description
 * Maps the creation to `OrganizationCreated`, member by member.
 *
 * @param {CreateOrganizationOutput} created - The organization and its invitations.
 * @returns {OrganizationCreated} The public answer.
 */
export function toOrganizationCreated(created: CreateOrganizationOutput): OrganizationCreated {
  return {
    organization: toOrganization(created.organization),
    invitations: created.invitations.map((invitation) => ({
      email: invitation.email,
      outcome: invitation.outcome,
      invitationId: invitation.invitationId,
    })),
  };
}

/**
 * Function toMyOrganizationPage
 *
 * @description
 * Maps a page of the organizations of the caller to `MyOrganizationPage`, member by member.
 *
 * @param {MyOrganizationPage} page - The page.
 * @returns {PublicMyOrganizationPage} The public page.
 */
export function toMyOrganizationPage(page: MyOrganizationPage): PublicMyOrganizationPage {
  return {
    items: page.items.map((organization: MyOrganization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: organization.role,
      memberCount: organization.memberCount,
      plan: organization.plan,
      joinedAt: organization.joinedAt,
    })),
    nextCursor: page.nextCursor,
  };
}

/**
 * Function toSessionOrganization
 *
 * @description
 * Maps the choice of the current organization to `SessionOrganization`.
 *
 * @param {SessionOrganization} chosen - The organization and the role of the session.
 * @returns {PublicSessionOrganization} The public answer.
 */
export function toSessionOrganization(chosen: SessionOrganization): PublicSessionOrganization {
  return { organizationId: chosen.organizationId, role: chosen.role };
}
