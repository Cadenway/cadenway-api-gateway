import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { noStore } from '../no-store.middleware.js';
import { AuthController } from './auth.controller.js';

/**
 * Class AuthRoutesModule
 *
 * @description
 * The routes of `openapi/public/auth.yaml` under `/v1/auth`. Every answer, errors included,
 * carries `Cache-Control: no-store`. The `IDENTITY_AUTH` port, the `SESSION_INTROSPECTOR` of
 * `SessionGuard` and `CONFIG` come from global modules: `ClientsModule` and `createApplication`.
 */
@Module({ controllers: [AuthController] })
export class AuthRoutesModule implements NestModule {
  // #region Methods
  /**
   * Method configure
   *
   * @description
   * Applies `noStore` to the routes of the module, before their guards.
   *
   * @param {MiddlewareConsumer} consumer - Middleware registry of NestJS.
   */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(AuthController);
  }
  // #endregion
}
