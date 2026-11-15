import { CONFIG } from '@cadenway/nest-common';
import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';

import type { AppConfig } from '../config/app-config.js';

/**
 * Constant CONNECTION_NAME
 *
 * @description
 * Name the connection announces with `CLIENT SETNAME`, so `CLIENT LIST` on the shared Redis of an
 * environment tells the gateway apart from the realtime gateway.
 *
 * @type {string}
 */
export const CONNECTION_NAME: string = 'api-gateway';

/**
 * Class RateLimitModule
 *
 * @description
 * Owns the Redis connection of the per-token rate-limit counters, provided under the
 * `ResilientRedisClient` class of `@cadenway/nest-common/redis`. Redis holds those counters and
 * nothing else for the gateway. The limiter itself (600 requests per minute per token, 429 with
 * `Retry-After`) is not built yet; it arrives here with the first authenticated routes.
 *
 * - The connection is opened at start-up from `REDIS_URL` without waiting for it: the application
 *   starts while Redis is still unreachable, and readiness answers 503 until it is ready.
 * - The offline queue is disabled, as rate-limiter-flexible recommends for ioredis: while Redis is
 *   unreachable a command fails at once instead of waiting for the reconnection, so readiness
 *   reports the outage and a request is never held by a counter. The client keeps reconnecting on
 *   its own.
 * - The client logs an outage once (`redis unreachable`, with an error code at most, never the
 *   address) and its end once (`redis reachable again`); it attaches a handler to every command it
 *   sends, so a command nobody awaits cannot stop the process.
 * - It is closed when the application stops.
 *
 * Imported by `AppModule` and by the `HealthModule` that builds the readiness indicator from it.
 */
@Module({
  providers: [
    {
      provide: ResilientRedisClient,
      inject: [CONFIG],
      useFactory: (config: AppConfig): ResilientRedisClient =>
        new ResilientRedisClient(config.REDIS_URL, {
          connectionName: CONNECTION_NAME,
          enableOfflineQueue: false,
        }),
    },
  ],
  exports: [ResilientRedisClient],
})
export class RateLimitModule implements OnApplicationShutdown {
  // #region Properties
  /**
   * Property client
   *
   * @description
   * Redis connection of the rate-limit counters, closed by `onApplicationShutdown`.
   *
   * @type {ResilientRedisClient}
   * @readonly
   */
  private readonly client: ResilientRedisClient;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps the connection to close it at shutdown.
   *
   * @param {ResilientRedisClient} client - Redis connection of the rate-limit counters.
   * @constructor
   */
  public constructor(@Inject(ResilientRedisClient) client: ResilientRedisClient) {
    this.client = client;
  }
  // #endregion

  // #region Methods
  /**
   * Method onApplicationShutdown
   *
   * @description
   * Closes the connection once the listener is closed. A ready connection is closed with `QUIT`,
   * which lets the commands already sent complete; any other state closes the socket at once and
   * stops the reconnection attempts, without a log line.
   *
   * @returns {Promise<void>} Resolves once the connection is closed.
   */
  public async onApplicationShutdown(): Promise<void> {
    await this.client.shutDown();
  }
  // #endregion
}
