import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { ArchiveRegistry } from './application/ports/outbound/task-service/archives/archive-registry.port.js';
import { ArchiveList } from './application/use-cases/commands/lists/archive-list/archive-list.use-case.js';
import { UnarchiveList } from './application/use-cases/commands/lists/unarchive-list/unarchive-list.use-case.js';
import { ArchiveTask } from './application/use-cases/commands/tasks/archive-task/archive-task.use-case.js';
import { UnarchiveTask } from './application/use-cases/commands/tasks/unarchive-task/unarchive-task.use-case.js';
import { ListArchivedLists } from './application/use-cases/queries/archives/list-archived-lists/list-archived-lists.use-case.js';
import { ListArchivedTasks } from './application/use-cases/queries/archives/list-archived-tasks/list-archived-tasks.use-case.js';
import { createArchiveRegistryAdapter } from './infrastructure/adapters/task-service/archive-registry.adapter.js';
import { ArchivesController } from './presentation/http/controllers/archives/archives.controller.js';

/**
 * Constant ARCHIVE_REGISTRY
 *
 * @description
 * Injection token of the `ArchiveRegistry` port.
 *
 * @type {unique symbol}
 */
const ARCHIVE_REGISTRY: unique symbol = Symbol('ArchiveRegistry');

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
    provide: ARCHIVE_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createArchiveRegistryAdapter,
  },
  {
    provide: ArchiveList,
    inject: [ARCHIVE_REGISTRY],
    useFactory: (registry: ArchiveRegistry): ArchiveList => new ArchiveList(registry),
  },
  {
    provide: UnarchiveList,
    inject: [ARCHIVE_REGISTRY],
    useFactory: (registry: ArchiveRegistry): UnarchiveList => new UnarchiveList(registry),
  },
  {
    provide: ArchiveTask,
    inject: [ARCHIVE_REGISTRY],
    useFactory: (registry: ArchiveRegistry): ArchiveTask => new ArchiveTask(registry),
  },
  {
    provide: UnarchiveTask,
    inject: [ARCHIVE_REGISTRY],
    useFactory: (registry: ArchiveRegistry): UnarchiveTask => new UnarchiveTask(registry),
  },
  {
    provide: ListArchivedLists,
    inject: [ARCHIVE_REGISTRY],
    useFactory: (registry: ArchiveRegistry): ListArchivedLists => new ListArchivedLists(registry),
  },
  {
    provide: ListArchivedTasks,
    inject: [ARCHIVE_REGISTRY],
    useFactory: (registry: ArchiveRegistry): ListArchivedTasks => new ListArchivedTasks(registry),
  },
];

/**
 * Class ArchivesModule
 *
 * @description
 * The routes of `openapi/public/archives.yaml`, served by task-service: archive and restore a
 * list or a task, and list the archived lists and tasks. The capability owns its port to
 * task-service and imports the shared authentication and rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [ArchivesController],
})
export class ArchivesModule {}
