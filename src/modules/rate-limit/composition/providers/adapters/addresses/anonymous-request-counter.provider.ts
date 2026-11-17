import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import { ANONYMOUS_REQUEST_COUNTER } from '../../../tokens/addresses/anonymous-request-counter.token.js';
import {
  RedisRequestCounter,
  type RequestQuota,
} from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';

/**
 * Constant ANONYMOUS_REQUEST_QUOTA
 *
 * @description
 * The quota of the requests without a credential, per client address (decision 2 of the P2b
 * security follow-ups): 60 requests per minute. A counter waits 100 milliseconds at most for
 * Redis, as the per-credential one does; the request is then counted in memory.
 *
 * @type {RequestQuota}
 */
export const ANONYMOUS_REQUEST_QUOTA: RequestQuota = Object.freeze({
  limit: 'anonymous',
  requests: 60,
  windowSeconds: 60,
  storeTimeoutMs: 100,
});

/**
 * Constant anonymousRequestCounterProvider
 *
 * @description
 * Binds the counter of the requests without a credential to the Redis counters of the gateway.
 *
 * @type {FactoryProvider<RequestCounter>}
 */
export const anonymousRequestCounterProvider: FactoryProvider<RequestCounter> = {
  provide: ANONYMOUS_REQUEST_COUNTER,
  inject: [ResilientRedisClient],
  useFactory: (redis: ResilientRedisClient): RequestCounter =>
    new RedisRequestCounter(redis, ANONYMOUS_REQUEST_QUOTA),
};
