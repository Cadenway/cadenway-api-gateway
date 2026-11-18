import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { IdentityServiceClient } from '../../clients/identity-service.client.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { AuthenticationPolicies } from './application/ports/outbound/identity/authentication-policies/authentication-policies.port.js';
import type { SessionOrganizations } from './application/ports/outbound/identity/sessions/session-organizations.port.js';
import type { OrganizationRegistry } from './application/ports/outbound/organization-service/organizations/organization-registry.port.js';
import { UpdateAuthenticationPolicy } from './application/use-cases/commands/authentication-policies/update-authentication-policy/update-authentication-policy.use-case.js';
import { CreateOrganization } from './application/use-cases/commands/organizations/create-organization/create-organization.use-case.js';
import { UpdateCurrentOrganization } from './application/use-cases/commands/organizations/update-current-organization/update-current-organization.use-case.js';
import { SwitchOrganization } from './application/use-cases/commands/sessions/switch-organization/switch-organization.use-case.js';
import { GetAuthenticationPolicy } from './application/use-cases/queries/authentication-policies/get-authentication-policy/get-authentication-policy.use-case.js';
import { GetCurrentOrganization } from './application/use-cases/queries/organizations/get-current-organization/get-current-organization.use-case.js';
import { ListMyOrganizations } from './application/use-cases/queries/organizations/list-my-organizations/list-my-organizations.use-case.js';
import { createAuthenticationPoliciesAdapter } from './infrastructure/adapters/identity/authentication-policies.adapter.js';
import { createSessionOrganizationsAdapter } from './infrastructure/adapters/identity/session-organizations.adapter.js';
import { createOrganizationRegistryAdapter } from './infrastructure/adapters/organization-service/organization-registry.adapter.js';
import { AuthenticationPolicyController } from './presentation/http/controllers/authentication-policies/authentication-policy.controller.js';
import { OrganizationsController } from './presentation/http/controllers/organizations/organizations.controller.js';

/**
 * Constant ORGANIZATION_REGISTRY
 *
 * @description
 * Injection token of the `OrganizationRegistry` port.
 *
 * @type {unique symbol}
 */
const ORGANIZATION_REGISTRY: unique symbol = Symbol('OrganizationRegistry');

/**
 * Constant SESSION_ORGANIZATIONS
 *
 * @description
 * Injection token of the `SessionOrganizations` port.
 *
 * @type {unique symbol}
 */
const SESSION_ORGANIZATIONS: unique symbol = Symbol('SessionOrganizations');

/**
 * Constant AUTHENTICATION_POLICIES
 *
 * @description
 * Injection token of the `AuthenticationPolicies` port.
 *
 * @type {unique symbol}
 */
const AUTHENTICATION_POLICIES: unique symbol = Symbol('AuthenticationPolicies');

/**
 * Constant PROVIDERS
 *
 * @description
 * The ports of the capability bound to their adapters, and the use cases bound to the ports.
 *
 * @type {readonly FactoryProvider[]}
 */
const PROVIDERS: readonly FactoryProvider[] = [
  {
    provide: ORGANIZATION_REGISTRY,
    inject: [OrganizationServiceClient],
    useFactory: createOrganizationRegistryAdapter,
  },
  {
    provide: SESSION_ORGANIZATIONS,
    inject: [IdentityServiceClient],
    useFactory: createSessionOrganizationsAdapter,
  },
  {
    provide: CreateOrganization,
    inject: [ORGANIZATION_REGISTRY],
    useFactory: (registry: OrganizationRegistry): CreateOrganization =>
      new CreateOrganization(registry),
  },
  {
    provide: ListMyOrganizations,
    inject: [ORGANIZATION_REGISTRY],
    useFactory: (registry: OrganizationRegistry): ListMyOrganizations =>
      new ListMyOrganizations(registry),
  },
  {
    provide: GetCurrentOrganization,
    inject: [ORGANIZATION_REGISTRY],
    useFactory: (registry: OrganizationRegistry): GetCurrentOrganization =>
      new GetCurrentOrganization(registry),
  },
  {
    provide: UpdateCurrentOrganization,
    inject: [ORGANIZATION_REGISTRY],
    useFactory: (registry: OrganizationRegistry): UpdateCurrentOrganization =>
      new UpdateCurrentOrganization(registry),
  },
  {
    provide: SwitchOrganization,
    inject: [SESSION_ORGANIZATIONS],
    useFactory: (sessions: SessionOrganizations): SwitchOrganization =>
      new SwitchOrganization(sessions),
  },
  {
    provide: AUTHENTICATION_POLICIES,
    inject: [IdentityServiceClient],
    useFactory: createAuthenticationPoliciesAdapter,
  },
  {
    provide: GetAuthenticationPolicy,
    inject: [AUTHENTICATION_POLICIES],
    useFactory: (policies: AuthenticationPolicies): GetAuthenticationPolicy =>
      new GetAuthenticationPolicy(policies),
  },
  {
    provide: UpdateAuthenticationPolicy,
    inject: [AUTHENTICATION_POLICIES],
    useFactory: (policies: AuthenticationPolicies): UpdateAuthenticationPolicy =>
      new UpdateAuthenticationPolicy(policies),
  },
];

/**
 * Class OrganizationsModule
 *
 * @description
 * The routes of `openapi/public/organizations.yaml`. The capability owns its ports to
 * organization-service (the organizations) and identity-service (the current organization of the
 * session and the authentication policy of the organization), and imports the shared
 * authentication and rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [OrganizationsController, AuthenticationPolicyController],
})
export class OrganizationsModule {}
