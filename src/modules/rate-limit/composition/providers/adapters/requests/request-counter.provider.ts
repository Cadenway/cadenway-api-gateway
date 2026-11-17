import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import { REQUEST_COUNTER } from '../../../tokens/requests/request-counter.token.js';
import {
  RedisRequestCounter,
  type RequestQuota,
} from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';

/**
 * Constant TOKEN_REQUEST_QUOTA
 *
 * @description
 * The quota of every session and personal API token (decision 8 of the integration plan, and the
 * "Rate limit" of `openapi/public/`): 600 requests per minute. A counter waits 100 milliseconds at
 * most for Redis, so a slow Redis never holds a request; the request is then counted in memory.
 *
 * @type {RequestQuota}
 */
export const TOKEN_REQUEST_QUOTA: RequestQuota = Object.freeze({
  limit: 'credential',
  requests: 600,
  windowSeconds: 60,
  storeTimeoutMs: 100,
});

/**
 * Constant requestCounterProvider
 *
 * @description
 * Binds the request counter port to the Redis counters of the gateway.
 *
 * @type {FactoryProvider<RequestCounter>}
 */
export const requestCounterProvider: FactoryProvider<RequestCounter> = {
  provide: REQUEST_COUNTER,
  inject: [ResilientRedisClient],
  useFactory: (redis: ResilientRedisClient): RequestCounter =>
    new RedisRequestCounter(redis, TOKEN_REQUEST_QUOTA),
};
