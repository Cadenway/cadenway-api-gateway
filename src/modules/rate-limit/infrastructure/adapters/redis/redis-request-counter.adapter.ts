import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  RLWrapperTimeouts,
  type RateLimiterAbstract,
} from 'rate-limiter-flexible';

import type { RequestAllowance } from '../../../application/models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../application/ports/outbound/counters/requests/request-counter.port.js';

/**
 * Interface RequestQuota
 *
 * @description
 * The quota a `RedisRequestCounter` enforces.
 */
export interface RequestQuota {
  // #region Properties
  /**
   * Property requests
   *
   * @description
   * Requests a key may make in one window.
   *
   * @type {number}
   * @readonly
   */
  readonly requests: number;

  /**
   * Property windowSeconds
   *
   * @description
   * Length of the window, in seconds; it starts with the first request of the key.
   *
   * @type {number}
   * @readonly
   */
  readonly windowSeconds: number;

  /**
   * Property storeTimeoutMs
   *
   * @description
   * Longest time a counter may wait for Redis, in milliseconds, before the request is counted in
   * memory instead.
   *
   * @type {number}
   * @readonly
   */
  readonly storeTimeoutMs: number;
  // #endregion
}

/**
 * Constant REDIS_RETRY_DELAY_MS
 *
 * @description
 * How long requests are counted in memory after Redis failed to count one, before Redis is tried
 * again, in milliseconds: a stalled Redis then costs one store timeout per second, not one per
 * request, and its pending commands do not pile up.
 *
 * @type {number}
 */
const REDIS_RETRY_DELAY_MS: number = 1000;

/**
 * Constant KEY_PREFIX
 *
 * @description
 * Prefix of the Redis keys of the counters: `rate-limit:<kind>:<id>`.
 *
 * @type {string}
 */
const KEY_PREFIX: string = 'rate-limit';

/**
 * Function allowance
 *
 * @description
 * Maps the answer of rate-limiter-flexible to a `RequestAllowance`.
 *
 * @param {RateLimiterRes | undefined} refusal - The refusal, `undefined` for a counted request.
 * @returns {RequestAllowance} The allowance.
 */
function allowance(refusal?: RateLimiterRes): RequestAllowance {
  return refusal === undefined
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(refusal.msBeforeNext / 1000)) };
}

/**
 * Class RedisRequestCounter
 *
 * @description
 * Counts requests in fixed windows on the Redis of the gateway with rate-limiter-flexible
 * (`RateLimiterRedis`: one atomic Lua script per request, keys that expire with their window), so
 * every instance of the gateway shares the counters.
 *
 * When Redis cannot count (unreachable, not ready, or slower than `storeTimeoutMs`), the request
 * is counted in the memory of this instance with the same quota for one second before Redis is
 * tried again, and a `warn` line says so once per outage; a line says when Redis counts again. The authenticated routes keep working, and a
 * credential is still limited per instance (at most the quota times the number of instances in a
 * window) rather than not at all. Redis answers again on its own: the connection keeps
 * reconnecting, and readiness reports the outage meanwhile.
 */
export class RedisRequestCounter implements RequestCounter {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Counters in Redis, bounded by the store timeout.
   *
   * @type {RateLimiterAbstract}
   * @readonly
   */
  private readonly store: RateLimiterAbstract;

  /**
   * Property fallback
   *
   * @description
   * Counters in the memory of this instance, used while Redis cannot count.
   *
   * @type {RateLimiterMemory}
   * @readonly
   */
  private readonly fallback: RateLimiterMemory;

  /**
   * Property logger
   *
   * @description
   * Logger of the outages of the counters.
   *
   * @type {Logger}
   * @readonly
   */
  private readonly logger: Logger;

  /**
   * Property degraded
   *
   * @description
   * `true` while requests are counted in memory.
   *
   * @type {boolean}
   */
  private degraded: boolean;

  /**
   * Property retryRedisAt
   *
   * @description
   * Instant, in milliseconds since the epoch, before which requests are counted in memory without
   * trying Redis.
   *
   * @type {number}
   */
  private retryRedisAt: number;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Builds the Redis counters and their in-memory fallback.
   *
   * @param {Redis} redis - The Redis connection of the gateway, without an offline queue.
   * @param {RequestQuota} quota - The quota to enforce.
   * @constructor
   */
  public constructor(redis: Redis, quota: RequestQuota) {
    const limiter: RateLimiterRedis = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: KEY_PREFIX,
      points: quota.requests,
      duration: quota.windowSeconds,
      rejectIfRedisNotReady: true,
    });
    this.store = new RLWrapperTimeouts({ limiter, timeoutMs: quota.storeTimeoutMs });
    this.fallback = new RateLimiterMemory({
      keyPrefix: KEY_PREFIX,
      points: quota.requests,
      duration: quota.windowSeconds,
    });
    this.logger = new Logger('RateLimit');
    this.degraded = false;
    this.retryRedisAt = 0;
  }
  // #endregion

  // #region Methods
  /**
   * Method consume
   *
   * @description
   * Counts one request of a key in Redis, or in memory while Redis cannot count.
   *
   * @param {string} key - Key of the counter.
   * @returns {Promise<RequestAllowance>} Whether the request is allowed, and when to retry.
   */
  public async consume(key: string): Promise<RequestAllowance> {
    if (Date.now() >= this.retryRedisAt) {
      try {
        await this.store.consume(key);
        this.recovered();
        return allowance();
      } catch (rejection) {
        if (rejection instanceof RateLimiterRes) {
          this.recovered();
          return allowance(rejection);
        }
        this.degrade(rejection);
      }
    }
    try {
      await this.fallback.consume(key);
      return allowance();
    } catch (rejection) {
      if (rejection instanceof RateLimiterRes) {
        return allowance(rejection);
      }
      throw rejection;
    }
  }

  /**
   * Method degrade
   *
   * @description
   * Records that Redis could not count: the next requests of the next second are counted in memory.
   * Logs it once per outage, with the kind of the failure only: neither the key nor the address of
   * Redis.
   *
   * @param {unknown} failure - What the Redis counter threw.
   */
  private degrade(failure: unknown): void {
    this.retryRedisAt = Date.now() + REDIS_RETRY_DELAY_MS;
    if (this.degraded) {
      return;
    }
    this.degraded = true;
    this.logger.warn(
      { reason: failure instanceof Error ? failure.name : 'unknown error' },
      'rate limit counted in memory: redis cannot count',
    );
  }

  /**
   * Method recovered
   *
   * @description
   * Records that Redis counts again, logging it when it ends an outage.
   */
  private recovered(): void {
    if (!this.degraded) {
      return;
    }
    this.degraded = false;
    this.logger.log({}, 'rate limit counted in redis again');
  }
  // #endregion
}
