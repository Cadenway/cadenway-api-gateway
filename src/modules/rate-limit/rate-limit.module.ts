import { Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { requestCounterProvider } from './composition/providers/adapters/requests/request-counter.provider.js';
import { countRequestProvider } from './composition/providers/use-cases/requests/count-request.provider.js';
import { CountRequest } from './public/requests/count-request.js';
import { RateLimitGuard } from './public/requests/rate-limit-guard.js';

/**
 * Class RateLimitModule
 *
 * @description
 * The per-credential rate limit of the gateway: 600 requests per minute per session or personal
 * API token, counted on the shared Redis of `RedisModule`. Exports `RateLimitGuard` for the route
 * modules, with the `CountRequest` use case it needs: a module that applies the guard
 * instantiates it in its own injector.
 */
@Module({
  imports: [RedisModule],
  providers: [requestCounterProvider, countRequestProvider, RateLimitGuard],
  exports: [RateLimitGuard, CountRequest],
})
export class RateLimitModule {}
