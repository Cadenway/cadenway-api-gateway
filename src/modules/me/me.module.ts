import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ClientsModule } from '../../clients/clients.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { identityUsersProvider } from './composition/providers/adapters/me/identity-users.provider.js';

import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { MeController } from './presentation/http/controllers/me/me.controller.js';

import { getCurrentUserProvider } from './composition/providers/use-cases/me/get-current-user.provider.js';
import { updateCurrentUserProvider } from './composition/providers/use-cases/me/update-current-user.provider.js';

/**
 * Class MeRoutesModule
 *
 * @description
 * `GET /v1/me` and `PATCH /v1/me` of `openapi/public/auth.yaml`. Every answer, errors included,
 * carries `Cache-Control: no-store`.
 * The capability owns its Identity port and imports the shared authentication and rate-limit
 * guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [identityUsersProvider, getCurrentUserProvider, updateCurrentUserProvider],
  controllers: [MeController],
})
export class MeRoutesModule implements NestModule {
  // #region Methods
  /**
   * Method configure
   *
   * @description
   * Applies `noStore` to the route of the module, before its guard.
   *
   * @param {MiddlewareConsumer} consumer - Middleware registry of NestJS.
   */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(MeController);
  }
  // #endregion
}
