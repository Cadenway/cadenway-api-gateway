import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { AccessRequestRegistry } from './application/ports/outbound/task-service/access-requests/access-request-registry.port.js';
import type { GrantRegistry } from './application/ports/outbound/task-service/grants/grant-registry.port.js';
import { ApproveAccessRequest } from './application/use-cases/commands/access-requests/approve-access-request/approve-access-request.use-case.js';
import { CreateAccessRequest } from './application/use-cases/commands/access-requests/create-access-request/create-access-request.use-case.js';
import { RefuseAccessRequest } from './application/use-cases/commands/access-requests/refuse-access-request/refuse-access-request.use-case.js';
import { RemoveListGrant } from './application/use-cases/commands/grants/remove-list-grant/remove-list-grant.use-case.js';
import { RemoveSpaceGrant } from './application/use-cases/commands/grants/remove-space-grant/remove-space-grant.use-case.js';
import { SetListGrant } from './application/use-cases/commands/grants/set-list-grant/set-list-grant.use-case.js';
import { SetSpaceGrant } from './application/use-cases/commands/grants/set-space-grant/set-space-grant.use-case.js';
import { ListAccessRequests } from './application/use-cases/queries/access-requests/list-access-requests/list-access-requests.use-case.js';
import { ListListGrants } from './application/use-cases/queries/grants/list-list-grants/list-list-grants.use-case.js';
import { ListSpaceGrants } from './application/use-cases/queries/grants/list-space-grants/list-space-grants.use-case.js';
import { createAccessRequestRegistryAdapter } from './infrastructure/adapters/task-service/access-request-registry.adapter.js';
import { createGrantRegistryAdapter } from './infrastructure/adapters/task-service/grant-registry.adapter.js';
import { AccessRequestsController } from './presentation/http/controllers/access-requests/access-requests.controller.js';
import { GrantsController } from './presentation/http/controllers/grants/grants.controller.js';

/**
 * Constant GRANT_REGISTRY
 *
 * @description
 * Injection token of the `GrantRegistry` port.
 *
 * @type {unique symbol}
 */
const GRANT_REGISTRY: unique symbol = Symbol('GrantRegistry');

/**
 * Constant ACCESS_REQUEST_REGISTRY
 *
 * @description
 * Injection token of the `AccessRequestRegistry` port.
 *
 * @type {unique symbol}
 */
const ACCESS_REQUEST_REGISTRY: unique symbol = Symbol('AccessRequestRegistry');

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
    provide: GRANT_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createGrantRegistryAdapter,
  },
  {
    provide: ACCESS_REQUEST_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createAccessRequestRegistryAdapter,
  },
  {
    provide: ListSpaceGrants,
    inject: [GRANT_REGISTRY],
    useFactory: (registry: GrantRegistry): ListSpaceGrants => new ListSpaceGrants(registry),
  },
  {
    provide: SetSpaceGrant,
    inject: [GRANT_REGISTRY],
    useFactory: (registry: GrantRegistry): SetSpaceGrant => new SetSpaceGrant(registry),
  },
  {
    provide: RemoveSpaceGrant,
    inject: [GRANT_REGISTRY],
    useFactory: (registry: GrantRegistry): RemoveSpaceGrant => new RemoveSpaceGrant(registry),
  },
  {
    provide: ListListGrants,
    inject: [GRANT_REGISTRY],
    useFactory: (registry: GrantRegistry): ListListGrants => new ListListGrants(registry),
  },
  {
    provide: SetListGrant,
    inject: [GRANT_REGISTRY],
    useFactory: (registry: GrantRegistry): SetListGrant => new SetListGrant(registry),
  },
  {
    provide: RemoveListGrant,
    inject: [GRANT_REGISTRY],
    useFactory: (registry: GrantRegistry): RemoveListGrant => new RemoveListGrant(registry),
  },
  {
    provide: CreateAccessRequest,
    inject: [ACCESS_REQUEST_REGISTRY],
    useFactory: (registry: AccessRequestRegistry): CreateAccessRequest =>
      new CreateAccessRequest(registry),
  },
  {
    provide: ListAccessRequests,
    inject: [ACCESS_REQUEST_REGISTRY],
    useFactory: (registry: AccessRequestRegistry): ListAccessRequests =>
      new ListAccessRequests(registry),
  },
  {
    provide: ApproveAccessRequest,
    inject: [ACCESS_REQUEST_REGISTRY],
    useFactory: (registry: AccessRequestRegistry): ApproveAccessRequest =>
      new ApproveAccessRequest(registry),
  },
  {
    provide: RefuseAccessRequest,
    inject: [ACCESS_REQUEST_REGISTRY],
    useFactory: (registry: AccessRequestRegistry): RefuseAccessRequest =>
      new RefuseAccessRequest(registry),
  },
];

/**
 * Class AccessModule
 *
 * @description
 * The routes of `openapi/public/access.yaml`, served by task-service: the grants of the spaces
 * and lists, and the access requests. The capability owns its ports to task-service and imports
 * the shared authentication and rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [GrantsController, AccessRequestsController],
})
export class AccessModule {}
