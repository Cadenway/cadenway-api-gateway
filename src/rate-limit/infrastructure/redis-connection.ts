import { CONFIG, redisIndicator, type HealthIndicator } from '@cadenway/nest-common';
import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { AppConfig } from '../../config/app-config.js';

/**
 * Constant CONNECTION_NAME
 *
 * @description
 * Name the connection announces with `CLIENT SETNAME`, so `CLIENT LIST` on the shared Redis of an
 * environment tells the gateway apart from the realtime gateway.
 *
 * @type {string}
 */
const CONNECTION_NAME: string = 'api-gateway';

/**
 * Class RedisConnection
 *
 * @description
 * The single Redis connection of the gateway, opened at start-up from `REDIS_URL` and closed when
 * the application shuts down. Redis holds the per-token rate-limit counters and nothing else; the
 * limiter that uses this connection arrives with the rate limit itself.
 *
 * The offline queue is disabled, as rate-limiter-flexible recommends for ioredis: while Redis is
 * unreachable a command fails at once instead of waiting for the reconnection, so readiness
 * reports the outage and a request is never held by a counter. The client keeps reconnecting on
 * its own. An outage is logged once, with an error code at most, and the return of the connection
 * once.
 */
@Injectable()
export class RedisConnection implements OnApplicationShutdown {
  // #region Properties
  /**
   * Property client
   *
   * @description
   * ioredis client of the rate-limit counters, shared by everything in this process that reads or
   * writes them.
   *
   * @type {Redis}
   * @readonly
   */
  public readonly client: Redis;

  /**
   * Property logger
   *
   * @description
   * Logger of the connection state; it never writes the address, which may carry a password.
   *
   * @type {Logger}
   * @readonly
   */
  private readonly logger: Logger = new Logger('Redis');

  /**
   * Property outageReported
   *
   * @description
   * Whether the current outage has been logged, so a reconnection attempt every few hundred
   * milliseconds does not write a line each time.
   *
   * @type {boolean}
   */
  private outageReported: boolean = false;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Opens the connection without waiting for it: the application starts while Redis is still
   * unreachable and readiness answers 503 until the connection is ready.
   *
   * @param {AppConfig} config - Validated configuration, for `REDIS_URL`.
   * @constructor
   */
  public constructor(@Inject(CONFIG) config: AppConfig) {
    this.client = new Redis(config.REDIS_URL, {
      connectionName: CONNECTION_NAME,
      enableOfflineQueue: false,
    });
    this.client.on('ready', () => {
      if (this.outageReported) {
        this.logger.log('Redis is reachable again.');
      }
      this.outageReported = false;
    });
    // A refused or failed connection emits `error`; a dropped one emits `reconnecting`, even when
    // the next attempts hang instead of failing. Either starts an outage.
    this.client.on('error', (error: Error) => {
      this.reportOutage(
        'code' in error && typeof error.code === 'string' ? error.code : error.name,
      );
    });
    this.client.on('reconnecting', () => {
      this.reportOutage('connection lost');
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method healthIndicator
   *
   * @description
   * Builds the readiness indicator of this connection: one `PING`, reported under the `redis`
   * key of `/health/ready`.
   *
   * @returns {HealthIndicator} The indicator for `HealthModule`.
   */
  public healthIndicator(): HealthIndicator {
    return redisIndicator(this.client);
  }

  /**
   * Method reportOutage
   *
   * @description
   * Logs the start of an outage once, until the connection is ready again. The reason is an error
   * code or a fixed phrase, never an error message, which may name the address.
   *
   * @param {string} reason - Error code, such as `ECONNREFUSED`, or `connection lost`.
   */
  private reportOutage(reason: string): void {
    if (this.outageReported) {
      return;
    }
    this.outageReported = true;
    this.logger.warn(`Redis is unreachable (${reason}); readiness answers 503 until it is back.`);
  }

  /**
   * Method onApplicationShutdown
   *
   * @description
   * Closes the connection when the application stops. A ready connection is closed with `QUIT`,
   * which lets the commands already sent complete; any other state, or a failed `QUIT`, closes the
   * socket at once and stops the reconnection attempts.
   *
   * @returns {Promise<void>} Resolves once the connection is closed.
   */
  public async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'ready') {
      try {
        await this.client.quit();
        return;
      } catch {
        // The connection broke during the shutdown: there is nothing left to complete.
      }
    }
    this.client.disconnect();
  }
  // #endregion
}
