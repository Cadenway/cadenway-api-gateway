import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { InvitationRegistry } from './application/ports/outbound/organization-service/invitations/invitation-registry.port.js';
import { InviteMembers } from './application/use-cases/commands/invitations/invite-members/invite-members.use-case.js';
import { ResendInvitation } from './application/use-cases/commands/invitations/resend-invitation/resend-invitation.use-case.js';
import { RevokeInvitation } from './application/use-cases/commands/invitations/revoke-invitation/revoke-invitation.use-case.js';
import { AcceptInvitation } from './application/use-cases/commands/received/accept-invitation/accept-invitation.use-case.js';
import { RefuseInvitation } from './application/use-cases/commands/received/refuse-invitation/refuse-invitation.use-case.js';
import { GetInvitation } from './application/use-cases/queries/invitations/get-invitation/get-invitation.use-case.js';
import { ListInvitations } from './application/use-cases/queries/invitations/list-invitations/list-invitations.use-case.js';
import { ListReceivedInvitations } from './application/use-cases/queries/received/list-received-invitations/list-received-invitations.use-case.js';
import { createInvitationRegistryAdapter } from './infrastructure/adapters/organization-service/invitation-registry.adapter.js';
import { InvitationsController } from './presentation/http/controllers/invitations/invitations.controller.js';
import { ReceivedInvitationsController } from './presentation/http/controllers/received-invitations/received-invitations.controller.js';

/**
 * Constant INVITATION_REGISTRY
 *
 * @description
 * Injection token of the `InvitationRegistry` port.
 *
 * @type {unique symbol}
 */
const INVITATION_REGISTRY: unique symbol = Symbol('InvitationRegistry');

/**
 * Constant PROVIDERS
 *
 * @description
 * The port of the capability bound to its adapter, and the use cases bound to the port.
 *
 * @type {readonly FactoryProvider[]}
 */
const PROVIDERS: readonly FactoryProvider[] = [
  {
    provide: INVITATION_REGISTRY,
    inject: [OrganizationServiceClient],
    useFactory: createInvitationRegistryAdapter,
  },
  {
    provide: InviteMembers,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): InviteMembers => new InviteMembers(registry),
  },
  {
    provide: GetInvitation,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): GetInvitation => new GetInvitation(registry),
  },
  {
    provide: ListInvitations,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): ListInvitations => new ListInvitations(registry),
  },
  {
    provide: RevokeInvitation,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): RevokeInvitation => new RevokeInvitation(registry),
  },
  {
    provide: ResendInvitation,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): ResendInvitation => new ResendInvitation(registry),
  },
  {
    provide: ListReceivedInvitations,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): ListReceivedInvitations =>
      new ListReceivedInvitations(registry),
  },
  {
    provide: AcceptInvitation,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): AcceptInvitation => new AcceptInvitation(registry),
  },
  {
    provide: RefuseInvitation,
    inject: [INVITATION_REGISTRY],
    useFactory: (registry: InvitationRegistry): RefuseInvitation => new RefuseInvitation(registry),
  },
];

/**
 * Class InvitationsModule
 *
 * @description
 * The invitation routes of `openapi/public/members.yaml`: those of the current organization
 * (`/v1/invitations`) and those of the invitee (`/v1/me/invitations`). The capability owns its
 * port to organization-service and imports the shared authentication and rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [InvitationsController, ReceivedInvitationsController],
})
export class InvitationsModule {}
