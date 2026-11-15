import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { noStore } from '../no-store.middleware.js';
import { MeController } from './me.controller.js';

/**
 * Class MeRoutesModule
 *
 * @description
 * `GET /v1/me` of `openapi/public/auth.yaml`. Every answer, errors included, carries
 * `Cache-Control: no-store`. The `IDENTITY_USERS` port, the `SESSION_INTROSPECTOR` of
 * `SessionGuard` and `CONFIG` come from global modules: `ClientsModule` and `createApplication`.
 */
@Module({ controllers: [MeController] })
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
