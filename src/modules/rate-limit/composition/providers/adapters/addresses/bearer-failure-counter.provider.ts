import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import { BEARER_FAILURE_COUNTER } from '../../../tokens/addresses/bearer-failure-counter.token.js';
import {
  RedisRequestCounter,
  type RequestQuota,
} from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';

/**
 * Constant BEARER_FAILURE_QUOTA
 *
 * @description
 * The quota of the failed bearer-token authentications, per client address (decision 2 of the
 * P2b security follow-ups): 10 per minute. A counter waits 100 milliseconds at most for Redis, as
 * the per-credential one does; the failure is then counted, or read, in memory.
 *
 * @type {RequestQuota}
 */
export const BEARER_FAILURE_QUOTA: RequestQuota = Object.freeze({
  limit: 'bearer-failures',
  requests: 10,
  windowSeconds: 60,
  storeTimeoutMs: 100,
});

/**
 * Constant bearerFailureCounterProvider
 *
 * @description
 * Binds the counter of the failed bearer-token authentications to the Redis counters of the
 * gateway.
 *
 * @type {FactoryProvider<RequestCounter>}
 */
export const bearerFailureCounterProvider: FactoryProvider<RequestCounter> = {
  provide: BEARER_FAILURE_COUNTER,
  inject: [ResilientRedisClient],
  useFactory: (redis: ResilientRedisClient): RequestCounter =>
    new RedisRequestCounter(redis, BEARER_FAILURE_QUOTA),
};
