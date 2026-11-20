import { DuplicateList } from './application/use-cases/commands/lists/duplicate-list/duplicate-list.use-case.js';
import { DuplicateListController } from './presentation/http/controllers/lists/duplicate-list.controller.js';
import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { ListRegistry } from './application/ports/outbound/task-service/lists/list-registry.port.js';
import { CreateList } from './application/use-cases/commands/lists/create-list/create-list.use-case.js';
import { DeleteList } from './application/use-cases/commands/lists/delete-list/delete-list.use-case.js';
import { UpdateList } from './application/use-cases/commands/lists/update-list/update-list.use-case.js';
import { ListListActivity } from './application/use-cases/queries/activity/list-list-activity/list-list-activity.use-case.js';
import { GetListCounts } from './application/use-cases/queries/lists/get-list-counts/get-list-counts.use-case.js';
import { GetList } from './application/use-cases/queries/lists/get-list/get-list.use-case.js';
import { ListLists } from './application/use-cases/queries/lists/list-lists/list-lists.use-case.js';
import { createListRegistryAdapter } from './infrastructure/adapters/task-service/list-registry.adapter.js';
import { ListsController } from './presentation/http/controllers/lists/lists.controller.js';

/**
 * Constant LIST_REGISTRY
 *
 * @description
 * Injection token of the `ListRegistry` port.
 *
 * @type {unique symbol}
 */
const LIST_REGISTRY: unique symbol = Symbol('ListRegistry');

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
    provide: DuplicateList,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): DuplicateList => new DuplicateList(registry),
  },
  {
    provide: LIST_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createListRegistryAdapter,
  },
  {
    provide: CreateList,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): CreateList => new CreateList(registry),
  },
  {
    provide: UpdateList,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): UpdateList => new UpdateList(registry),
  },
  {
    provide: DeleteList,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): DeleteList => new DeleteList(registry),
  },
  {
    provide: ListListActivity,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): ListListActivity => new ListListActivity(registry),
  },
  {
    provide: GetListCounts,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): GetListCounts => new GetListCounts(registry),
  },
  {
    provide: GetList,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): GetList => new GetList(registry),
  },
  {
    provide: ListLists,
    inject: [LIST_REGISTRY],
    useFactory: (registry: ListRegistry): ListLists => new ListLists(registry),
  },
];

/**
 * Class ListsModule
 *
 * @description
 * The list and sprint routes of `openapi/public/lists.yaml`, served by task-service. The capability owns its port to task-service and imports the shared authentication and
 * rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [DuplicateListController, ListsController],
})
export class ListsModule {}
