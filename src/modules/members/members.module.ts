import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { MemberDirectory } from './application/ports/outbound/organization-service/members/member-directory.port.js';
import { ChangeMemberRole } from './application/use-cases/commands/members/change-member-role/change-member-role.use-case.js';
import { RemoveMember } from './application/use-cases/commands/members/remove-member/remove-member.use-case.js';
import { GetMember } from './application/use-cases/queries/members/get-member/get-member.use-case.js';
import { ListMembers } from './application/use-cases/queries/members/list-members/list-members.use-case.js';
import { createMemberDirectoryAdapter } from './infrastructure/adapters/organization-service/member-directory.adapter.js';
import { MembersController } from './presentation/http/controllers/members/members.controller.js';

/**
 * Constant MEMBER_DIRECTORY
 *
 * @description
 * Injection token of the `MemberDirectory` port.
 *
 * @type {unique symbol}
 */
const MEMBER_DIRECTORY: unique symbol = Symbol('MemberDirectory');

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
    provide: MEMBER_DIRECTORY,
    inject: [OrganizationServiceClient],
    useFactory: createMemberDirectoryAdapter,
  },
  {
    provide: ListMembers,
    inject: [MEMBER_DIRECTORY],
    useFactory: (directory: MemberDirectory): ListMembers => new ListMembers(directory),
  },
  {
    provide: GetMember,
    inject: [MEMBER_DIRECTORY],
    useFactory: (directory: MemberDirectory): GetMember => new GetMember(directory),
  },
  {
    provide: ChangeMemberRole,
    inject: [MEMBER_DIRECTORY],
    useFactory: (directory: MemberDirectory): ChangeMemberRole => new ChangeMemberRole(directory),
  },
  {
    provide: RemoveMember,
    inject: [MEMBER_DIRECTORY],
    useFactory: (directory: MemberDirectory): RemoveMember => new RemoveMember(directory),
  },
];

/**
 * Class MembersModule
 *
 * @description
 * The member routes of `openapi/public/members.yaml`. The capability owns its port to
 * organization-service and imports the shared authentication and rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [MembersController],
})
export class MembersModule {}
