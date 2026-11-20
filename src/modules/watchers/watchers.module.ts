import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { WatchersRegistry } from './application/ports/outbound/task-service/watchers/watchers-registry.port.js';
import { createWatchersRegistry } from './infrastructure/adapters/task-service/watchers-registry.adapter.js';
import { WatchersController } from './presentation/http/controllers/watchers/watchers.controller.js';
import { ListTaskWatchers } from './application/use-cases/queries/watchers/list-task-watchers/list-task-watchers.use-case.js';
import { FollowTaskWatcher } from './application/use-cases/commands/watchers/follow-task-watcher/follow-task-watcher.use-case.js';
import { UnfollowTaskWatcher } from './application/use-cases/commands/watchers/unfollow-task-watcher/unfollow-task-watcher.use-case.js';

/** Injection token for task-service. */
const REGISTRY = Symbol('WatchersRegistry');

/** Wires the watcher capability. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [WatchersController],
  providers: [
    { provide: REGISTRY, inject: [TaskServiceClient], useFactory: createWatchersRegistry },
    {
      provide: ListTaskWatchers,
      inject: [REGISTRY],
      useFactory: (registry: WatchersRegistry): ListTaskWatchers => new ListTaskWatchers(registry),
    },
    {
      provide: FollowTaskWatcher,
      inject: [REGISTRY],
      useFactory: (registry: WatchersRegistry): FollowTaskWatcher =>
        new FollowTaskWatcher(registry),
    },
    {
      provide: UnfollowTaskWatcher,
      inject: [REGISTRY],
      useFactory: (registry: WatchersRegistry): UnfollowTaskWatcher =>
        new UnfollowTaskWatcher(registry),
    },
  ],
})
export class WatchersModule {}
