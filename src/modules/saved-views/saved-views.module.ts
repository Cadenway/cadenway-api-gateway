import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { SavedViewsRegistry } from './application/ports/outbound/task-service/views/saved-views-registry.port.js';
import { createSavedViewsRegistry } from './infrastructure/adapters/task-service/saved-views-registry.adapter.js';
import { SavedViewsController } from './presentation/http/controllers/saved-views/saved-views.controller.js';
import { ListSavedViews } from './application/use-cases/queries/views/list-saved-views/list-saved-views.use-case.js';
import { CreateSavedView } from './application/use-cases/commands/views/create-saved-view/create-saved-view.use-case.js';
import { GetSavedView } from './application/use-cases/queries/views/get-saved-view/get-saved-view.use-case.js';
import { UpdateSavedView } from './application/use-cases/commands/views/update-saved-view/update-saved-view.use-case.js';
import { DeleteSavedView } from './application/use-cases/commands/views/delete-saved-view/delete-saved-view.use-case.js';
import { DuplicateSavedView } from './application/use-cases/commands/views/duplicate-saved-view/duplicate-saved-view.use-case.js';

/** Injection token for task-service. */
const REGISTRY = Symbol('SavedViewsRegistry');

/** Wires the saved views capability. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [SavedViewsController],
  providers: [
    { provide: REGISTRY, inject: [TaskServiceClient], useFactory: createSavedViewsRegistry },
    {
      provide: ListSavedViews,
      inject: [REGISTRY],
      useFactory: (registry: SavedViewsRegistry): ListSavedViews => new ListSavedViews(registry),
    },
    {
      provide: CreateSavedView,
      inject: [REGISTRY],
      useFactory: (registry: SavedViewsRegistry): CreateSavedView => new CreateSavedView(registry),
    },
    {
      provide: GetSavedView,
      inject: [REGISTRY],
      useFactory: (registry: SavedViewsRegistry): GetSavedView => new GetSavedView(registry),
    },
    {
      provide: UpdateSavedView,
      inject: [REGISTRY],
      useFactory: (registry: SavedViewsRegistry): UpdateSavedView => new UpdateSavedView(registry),
    },
    {
      provide: DeleteSavedView,
      inject: [REGISTRY],
      useFactory: (registry: SavedViewsRegistry): DeleteSavedView => new DeleteSavedView(registry),
    },
    {
      provide: DuplicateSavedView,
      inject: [REGISTRY],
      useFactory: (registry: SavedViewsRegistry): DuplicateSavedView =>
        new DuplicateSavedView(registry),
    },
  ],
})
export class SavedViewsModule {}
