import { Global, Module } from '@nestjs/common';

import { RedisConnection } from './infrastructure/redis-connection.js';

export { RedisConnection };

/**
 * Class RateLimitModule
 *
 * @description
 * Owns the Redis connection of the per-token rate-limit counters. The limiter itself (600 requests
 * per minute per token, 429 with `Retry-After`) is not built yet; it arrives here with the first
 * authenticated routes.
 *
 * Global, because `HealthModule.forRootAsync` builds the readiness indicator from
 * `RedisConnection` and only resolves providers that are visible globally. `RedisConnection` is
 * re-exported so that the application module names it through this module, never through its
 * infrastructure file.
 */
@Global()
@Module({ providers: [RedisConnection], exports: [RedisConnection] })
export class RateLimitModule {}
