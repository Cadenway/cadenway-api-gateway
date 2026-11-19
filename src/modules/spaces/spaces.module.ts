import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { SpaceRegistry } from './application/ports/outbound/task-service/spaces/space-registry.port.js';
import { CreateSpace } from './application/use-cases/commands/spaces/create-space/create-space.use-case.js';
import { DeleteSpace } from './application/use-cases/commands/spaces/delete-space/delete-space.use-case.js';
import { UpdateSpace } from './application/use-cases/commands/spaces/update-space/update-space.use-case.js';
import { GetSpaceOverview } from './application/use-cases/queries/spaces/get-space-overview/get-space-overview.use-case.js';
import { GetSpace } from './application/use-cases/queries/spaces/get-space/get-space.use-case.js';
import { ListSpaces } from './application/use-cases/queries/spaces/list-spaces/list-spaces.use-case.js';
import { createSpaceRegistryAdapter } from './infrastructure/adapters/task-service/space-registry.adapter.js';
import { SpacesController } from './presentation/http/controllers/spaces/spaces.controller.js';

/**
 * Constant SPACE_REGISTRY
 *
 * @description
 * Injection token of the `SpaceRegistry` port.
 *
 * @type {unique symbol}
 */
const SPACE_REGISTRY: unique symbol = Symbol('SpaceRegistry');

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
    provide: SPACE_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createSpaceRegistryAdapter,
  },
  {
    provide: CreateSpace,
    inject: [SPACE_REGISTRY],
    useFactory: (registry: SpaceRegistry): CreateSpace => new CreateSpace(registry),
  },
  {
    provide: UpdateSpace,
    inject: [SPACE_REGISTRY],
    useFactory: (registry: SpaceRegistry): UpdateSpace => new UpdateSpace(registry),
  },
  {
    provide: DeleteSpace,
    inject: [SPACE_REGISTRY],
    useFactory: (registry: SpaceRegistry): DeleteSpace => new DeleteSpace(registry),
  },
  {
    provide: GetSpaceOverview,
    inject: [SPACE_REGISTRY],
    useFactory: (registry: SpaceRegistry): GetSpaceOverview => new GetSpaceOverview(registry),
  },
  {
    provide: GetSpace,
    inject: [SPACE_REGISTRY],
    useFactory: (registry: SpaceRegistry): GetSpace => new GetSpace(registry),
  },
  {
    provide: ListSpaces,
    inject: [SPACE_REGISTRY],
    useFactory: (registry: SpaceRegistry): ListSpaces => new ListSpaces(registry),
  },
];

/**
 * Class SpacesModule
 *
 * @description
 * The space routes of `openapi/public/spaces.yaml`, served by task-service. The capability owns its port to task-service and imports the shared authentication and
 * rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [SpacesController],
})
export class SpacesModule {}
