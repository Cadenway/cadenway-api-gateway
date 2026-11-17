import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  RateLimiterRedis,
  RateLimiterRes,
  RLWrapperTimeouts,
  type RateLimiterAbstract,
} from 'rate-limiter-flexible';

import type { RequestAllowance } from '../../../application/models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../application/ports/outbound/counters/requests/request-counter.port.js';
import { BoundedMemoryWindows } from '../memory/bounded-memory-windows.js';

/**
 * Interface RequestQuota
 *
 * @description
 * The quota a `RedisRequestCounter` enforces.
 */
export interface RequestQuota {
  // #region Properties
  /**
   * Property limit
   *
   * @description
   * Name of the limit in the log lines of an outage: `credential`, `anonymous` or
   * `bearer-failures`. Never part of a key.
   *
   * @type {string}
   * @readonly
   */
  readonly limit: string;

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
 * Constant MAX_FALLBACK_KEYS
 *
 * @description
 * Most keys a counter holds in memory while Redis cannot count: about 170 bytes each, so about
 * 8 MB per counter at most, whatever the number of addresses a flood rotates through. Past it, new
 * keys share one overflow window (see `BoundedMemoryWindows`).
 *
 * @type {number}
 */
const MAX_FALLBACK_KEYS: number = 50_000;

/**
 * Constant KEY_PREFIX
 *
 * @description
 * Prefix of the Redis keys of the counters: `rate-limit:<kind>:<id>` for a credential,
 * `rate-limit:anonymous:<pseudonym>` and `rate-limit:bearer-failures:<pseudonym>` for a client
 * address.
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
 * When Redis cannot count or read a counter (unreachable, not ready, or slower than
 * `storeTimeoutMs`), the request is counted or read in the memory of this instance with the same
 * quota, and a `warn` line names the limit once per outage; a line says when Redis counts again.
 * Once a second, one request tries Redis again while the others keep counting in memory. The
 * routes keep working, and a key is still limited per instance (at most the quota times the
 * number of instances in a window) rather than not at all; the memory holds at most
 * `MAX_FALLBACK_KEYS` keys per counter. Redis answers again on its own: the connection keeps
 * reconnecting, and readiness reports the outage meanwhile.
 */
export class RedisRequestCounter implements RequestCounter {
  // #region Properties
  /**
   * Property quota
   *
   * @description
   * The quota this counter enforces.
   *
   * @type {RequestQuota}
   * @readonly
   */
  private readonly quota: RequestQuota;

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
   * @type {BoundedMemoryWindows}
   * @readonly
   */
  private readonly fallback: BoundedMemoryWindows;

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
   * trying Redis; `0` while Redis counts.
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
    this.quota = quota;
    const limiter: RateLimiterRedis = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: KEY_PREFIX,
      points: quota.requests,
      duration: quota.windowSeconds,
      rejectIfRedisNotReady: true,
    });
    this.store = new RLWrapperTimeouts({ limiter, timeoutMs: quota.storeTimeoutMs });
    this.fallback = new BoundedMemoryWindows({
      requests: quota.requests,
      windowSeconds: quota.windowSeconds,
      maxKeys: MAX_FALLBACK_KEYS,
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
    if (this.triesRedis()) {
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
    return this.fallback.consume(key, Date.now());
  }

  /**
   * Method peek
   *
   * @description
   * Reads the counter of a key in Redis, or in memory while Redis cannot count, without counting
   * a request: one more fits while fewer requests than the quota were counted in the window.
   *
   * @param {string} key - Key of the counter.
   * @returns {Promise<RequestAllowance>} Whether one more request fits, and when to retry.
   */
  public async peek(key: string): Promise<RequestAllowance> {
    if (this.triesRedis()) {
      try {
        const state: RateLimiterRes | null = await this.store.get(key);
        this.recovered();
        return this.remainingOf(state);
      } catch (failure) {
        this.degrade(failure);
      }
    }
    return this.fallback.peek(key, Date.now());
  }

  /**
   * Method triesRedis
   *
   * @description
   * Tells whether this request goes to Redis: always while Redis counts; during an outage, one
   * request a second, and the requests that come while it waits count in memory, so a stalled
   * Redis holds one request a second rather than every request of that moment.
   *
   * @returns {boolean} `true` when the request tries Redis.
   */
  private triesRedis(): boolean {
    const now: number = Date.now();
    if (now < this.retryRedisAt) {
      return false;
    }
    if (this.degraded) {
      this.retryRedisAt = now + REDIS_RETRY_DELAY_MS;
    }
    return true;
  }

  /**
   * Method remainingOf
   *
   * @description
   * Maps the state of a counter to whether one more request fits in the quota.
   *
   * @param {RateLimiterRes | null} state - The counter, `null` when the key has no window yet.
   * @returns {RequestAllowance} The allowance.
   */
  private remainingOf(state: RateLimiterRes | null): RequestAllowance {
    return state === null || state.consumedPoints < this.quota.requests
      ? allowance()
      : allowance(state);
  }

  /**
   * Method degrade
   *
   * @description
   * Records that Redis could not count: the next requests of the next second are counted in memory.
   * Logs it once per outage, with the name of the limit and the kind of the failure only: neither
   * the key nor the address of Redis.
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
      {
        limit: this.quota.limit,
        reason: failure instanceof Error ? failure.name : 'unknown error',
      },
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
    this.retryRedisAt = 0;
    this.logger.log({ limit: this.quota.limit }, 'rate limit counted in redis again');
  }
  // #endregion
}
