import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { FavoritesRegistry } from './application/ports/outbound/task-service/favorites/favorites-registry.port.js';
import { createFavoritesRegistry } from './infrastructure/adapters/task-service/favorites-registry.adapter.js';
import { FavoritesController } from './presentation/http/controllers/favorites/favorites.controller.js';
import { ListFavorites } from './application/use-cases/queries/favorites/list-favorites/list-favorites.use-case.js';
import { CreateFavorite } from './application/use-cases/commands/favorites/create-favorite/create-favorite.use-case.js';
import { GetFavorite } from './application/use-cases/queries/favorites/get-favorite/get-favorite.use-case.js';
import { DeleteFavorite } from './application/use-cases/commands/favorites/delete-favorite/delete-favorite.use-case.js';

/** Injection token for task-service. */
const REGISTRY = Symbol('FavoritesRegistry');

/** Wires the favorites capability. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [FavoritesController],
  providers: [
    { provide: REGISTRY, inject: [TaskServiceClient], useFactory: createFavoritesRegistry },
    {
      provide: ListFavorites,
      inject: [REGISTRY],
      useFactory: (registry: FavoritesRegistry): ListFavorites => new ListFavorites(registry),
    },
    {
      provide: CreateFavorite,
      inject: [REGISTRY],
      useFactory: (registry: FavoritesRegistry): CreateFavorite => new CreateFavorite(registry),
    },
    {
      provide: GetFavorite,
      inject: [REGISTRY],
      useFactory: (registry: FavoritesRegistry): GetFavorite => new GetFavorite(registry),
    },
    {
      provide: DeleteFavorite,
      inject: [REGISTRY],
      useFactory: (registry: FavoritesRegistry): DeleteFavorite => new DeleteFavorite(registry),
    },
  ],
})
export class FavoritesModule {}
