import {
  Module,
  type FactoryProvider,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { IdentityServiceClient } from '../../clients/identity-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { ApiTokenRegistry } from './application/ports/outbound/identity/api-tokens/api-token-registry.port.js';
import { CreateApiToken } from './application/use-cases/commands/api-tokens/create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from './application/use-cases/commands/api-tokens/revoke-api-token/revoke-api-token.use-case.js';
import { ListApiTokens } from './application/use-cases/queries/api-tokens/list-api-tokens/list-api-tokens.use-case.js';
import { createApiTokenRegistryAdapter } from './infrastructure/adapters/identity/api-token-registry.adapter.js';
import { ApiTokensController } from './presentation/http/controllers/api-tokens/api-tokens.controller.js';

/**
 * Constant API_TOKEN_REGISTRY
 *
 * @description
 * Injection token of the `ApiTokenRegistry` port.
 *
 * @type {unique symbol}
 */
const API_TOKEN_REGISTRY: unique symbol = Symbol('ApiTokenRegistry');

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
    provide: API_TOKEN_REGISTRY,
    inject: [IdentityServiceClient],
    useFactory: createApiTokenRegistryAdapter,
  },
  {
    provide: CreateApiToken,
    inject: [API_TOKEN_REGISTRY],
    useFactory: (registry: ApiTokenRegistry): CreateApiToken => new CreateApiToken(registry),
  },
  {
    provide: ListApiTokens,
    inject: [API_TOKEN_REGISTRY],
    useFactory: (registry: ApiTokenRegistry): ListApiTokens => new ListApiTokens(registry),
  },
  {
    provide: RevokeApiToken,
    inject: [API_TOKEN_REGISTRY],
    useFactory: (registry: ApiTokenRegistry): RevokeApiToken => new RevokeApiToken(registry),
  },
];

/**
 * Class ApiTokensModule
 *
 * @description
 * The routes of `openapi/public/api-tokens.yaml`. The capability owns its port to
 * identity-service and imports the shared authentication and rate-limit guards. Every answer,
 * errors included, carries `Cache-Control: no-store`: the creation returns the secret of the token.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [ApiTokensController],
})
export class ApiTokensModule implements NestModule {
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
    consumer.apply(noStore).forRoutes(ApiTokensController);
  }
  // #endregion
}
