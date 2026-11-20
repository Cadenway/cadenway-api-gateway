import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { TrashRegistry } from './application/ports/outbound/task-service/trash/trash-registry.port.js';
import { EmptyTrash } from './application/use-cases/commands/trash/empty-trash/empty-trash.use-case.js';
import { PurgeTrashEntry } from './application/use-cases/commands/trash/purge-trash-entry/purge-trash-entry.use-case.js';
import { RestoreTrashEntry } from './application/use-cases/commands/trash/restore-trash-entry/restore-trash-entry.use-case.js';
import { TrashTask } from './application/use-cases/commands/trash/trash-task/trash-task.use-case.js';
import { ListTrash } from './application/use-cases/queries/trash/list-trash/list-trash.use-case.js';
import { createTrashRegistryAdapter } from './infrastructure/adapters/task-service/trash-registry.adapter.js';
import { TrashController } from './presentation/http/controllers/trash/trash.controller.js';

/**
 * Constant TRASH_REGISTRY
 *
 * @description
 * Injection token of the `TrashRegistry` port.
 *
 * @type {unique symbol}
 */
const TRASH_REGISTRY: unique symbol = Symbol('TrashRegistry');

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
    provide: TRASH_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createTrashRegistryAdapter,
  },
  {
    provide: TrashTask,
    inject: [TRASH_REGISTRY],
    useFactory: (registry: TrashRegistry): TrashTask => new TrashTask(registry),
  },
  {
    provide: ListTrash,
    inject: [TRASH_REGISTRY],
    useFactory: (registry: TrashRegistry): ListTrash => new ListTrash(registry),
  },
  {
    provide: RestoreTrashEntry,
    inject: [TRASH_REGISTRY],
    useFactory: (registry: TrashRegistry): RestoreTrashEntry => new RestoreTrashEntry(registry),
  },
  {
    provide: PurgeTrashEntry,
    inject: [TRASH_REGISTRY],
    useFactory: (registry: TrashRegistry): PurgeTrashEntry => new PurgeTrashEntry(registry),
  },
  {
    provide: EmptyTrash,
    inject: [TRASH_REGISTRY],
    useFactory: (registry: TrashRegistry): EmptyTrash => new EmptyTrash(registry),
  },
];

/**
 * Class TrashModule
 *
 * @description
 * The routes of `openapi/public/trash.yaml`, served by task-service: delete a task with its
 * subtasks, list the trash, restore or erase an entry, empty the trash. The capability owns its
 * port to task-service and imports the shared authentication and rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [TrashController],
})
export class TrashModule {}
