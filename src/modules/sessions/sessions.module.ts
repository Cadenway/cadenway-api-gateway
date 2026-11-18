import {
  Module,
  type FactoryProvider,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { IdentityServiceClient } from '../../clients/identity-service.client.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { SessionRegistry } from './application/ports/outbound/identity/sessions/session-registry.port.js';
import { RevokeOtherSessions } from './application/use-cases/commands/sessions/revoke-other-sessions/revoke-other-sessions.use-case.js';
import { RevokeSession } from './application/use-cases/commands/sessions/revoke-session/revoke-session.use-case.js';
import { ListSessions } from './application/use-cases/queries/sessions/list-sessions/list-sessions.use-case.js';
import { createSessionRegistryAdapter } from './infrastructure/adapters/identity/session-registry.adapter.js';
import { SessionsController } from './presentation/http/controllers/sessions/sessions.controller.js';

/**
 * Constant SESSION_REGISTRY
 *
 * @description
 * Injection token of the `SessionRegistry` port.
 *
 * @type {unique symbol}
 */
const SESSION_REGISTRY: unique symbol = Symbol('SessionRegistry');

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
    provide: SESSION_REGISTRY,
    inject: [IdentityServiceClient],
    useFactory: createSessionRegistryAdapter,
  },
  {
    provide: ListSessions,
    inject: [SESSION_REGISTRY],
    useFactory: (registry: SessionRegistry): ListSessions => new ListSessions(registry),
  },
  {
    provide: RevokeSession,
    inject: [SESSION_REGISTRY],
    useFactory: (registry: SessionRegistry): RevokeSession => new RevokeSession(registry),
  },
  {
    provide: RevokeOtherSessions,
    inject: [SESSION_REGISTRY],
    useFactory: (registry: SessionRegistry): RevokeOtherSessions =>
      new RevokeOtherSessions(registry),
  },
];

/**
 * Class SessionsModule
 *
 * @description
 * The routes of the tag `sessions` of `openapi/public/auth.yaml` under `/v1/sessions`. The
 * capability owns its port to identity-service and imports the shared authentication and
 * rate-limit guards. Every answer, errors included, carries `Cache-Control: no-store`, as the
 * contract requires of the routes of this tag.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [SessionsController],
})
export class SessionsModule implements NestModule {
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
    consumer.apply(noStore).forRoutes(SessionsController);
  }
  // #endregion
}
