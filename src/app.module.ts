import { HealthModule, redisIndicator, type HealthModuleOptions } from '@cadenway/nest-common';
import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import { Module } from '@nestjs/common';

import { ClientsModule } from './clients/clients.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { AuthRoutesModule } from './routes/auth/auth-routes.module.js';
import { MeRoutesModule } from './routes/me/me-routes.module.js';

/**
 * Constant SHUTDOWN_DELAY_MS
 *
 * @description
 * How long the stop keeps serving with readiness at 503 before it closes the listener, in
 * milliseconds.
 *
 * Traefik routes to the containers Docker reports healthy and learns about them through Docker
 * events, applied at most every 2 seconds (its default provider throttle, which cadenway-ops does
 * not change). During a rolling update the GitOps agent stops the old container as soon as the new
 * one is healthy (it polls every 2 seconds): for up to 2 seconds more Traefik may still route only
 * to the old one. Three seconds keep it answering through that window. Readiness itself does not
 * take the instance out of Traefik: the container healthcheck needs five failed probes ten seconds
 * apart, longer than the 30 seconds the agent gives a stop; Traefik drops the instance when it
 * exits. The delay stays well under the 10 second default grace period of Docker.
 *
 * @type {number}
 */
export const SHUTDOWN_DELAY_MS: number = 3000;

/**
 * Class AppModule
 *
 * @description
 * Root module of the gateway, wrapped by `createApplication` of `@cadenway/nest-common`, which
 * adds the logs, the error format, the validation pipe, the interceptors, the body limit and the
 * request deadline.
 *
 * - `CONFIG` is not provided here: `createGatewayApplication` hands the configuration that
 *   `main.ts` validated once to `createApplication` (`provideConfig: true`), which provides it
 *   globally. Importing this module reads nothing.
 * - `ClientsModule` builds the clients of the internal services (identity-service today) and
 *   provides, globally, the ports the guards and routes use.
 * - `AuthRoutesModule` and `MeRoutesModule` serve the routes of `openapi/public/auth.yaml`.
 * - `RateLimitModule` opens the Redis connection of the rate-limit counters.
 * - `HealthModule` serves `GET /health/live`, which checks nothing, and `GET /health/ready`, which
 *   answers 503 while Redis does not answer `PING` within one second, and from the start of the
 *   stop (see `SHUTDOWN_DELAY_MS`). Both are what the container healthcheck and the deployment
 *   probe.
 *
 * The gateway has no broker connection yet: it gets NATS when it publishes its usage event, as
 * cadenway-ops `docs/service-environment.md` lists. The modules of `src/routes/`,
 * `src/aggregates/` and `src/public/` are registered here as they are created; `src/auth/` holds
 * guards, which the controllers use directly, and no module.
 */
@Module({
  imports: [
    ClientsModule,
    RateLimitModule,
    HealthModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [ResilientRedisClient],
      useFactory: (redis: ResilientRedisClient): HealthModuleOptions => ({
        indicators: [redisIndicator(redis)],
        shutdownDelayMs: SHUTDOWN_DELAY_MS,
      }),
    }),
    AuthRoutesModule,
    MeRoutesModule,
  ],
})
export class AppModule {}
