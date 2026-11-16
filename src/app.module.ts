import { HealthModule, redisIndicator, type HealthModuleOptions } from '@cadenway/nest-common';
import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import { Module, type Type } from '@nestjs/common';

import { RateLimitModule } from './infrastructure/redis/rate-limit.module.js';
import { AuthRoutesModule } from './modules/auth-routes/auth-routes.module.js';
import { MeRoutesModule } from './modules/me/me.module.js';

/**
 * Constant ROUTE_MODULES
 *
 * @description
 * The modules of the public routes, in the order they are registered: `AppModule` imports them,
 * and the route tests serve the same list with the internal services faked, so a route module
 * added here is tested as it is served.
 *
 * @type {readonly Type[]}
 */
export const ROUTE_MODULES: readonly Type[] = [AuthRoutesModule, MeRoutesModule];

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
 * - Route capabilities import technical clients and bind their own ports.
 * - `ROUTE_MODULES` serve the public routes: `AuthRoutesModule` and `MeRoutesModule`, the routes
 *   of `openapi/public/auth.yaml`.
 * - `RateLimitModule` opens the Redis connection of the rate-limit counters.
 * - `HealthModule` serves `GET /health/live`, which checks nothing, and `GET /health/ready`, which
 *   answers 503 while Redis does not answer `PING` within one second, and from the start of the
 *   stop (see `SHUTDOWN_DELAY_MS`). Both are what the container healthcheck and the deployment
 *   probe.
 *
 * The gateway has no broker connection yet: it gets NATS when it publishes its usage event, as
 * cadenway-ops `docs/service-environment.md` lists. Public HTTP capabilities under `src/modules/` register here as they are created.
 */
@Module({
  imports: [
    RateLimitModule,
    HealthModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [ResilientRedisClient],
      useFactory: (redis: ResilientRedisClient): HealthModuleOptions => ({
        indicators: [redisIndicator(redis)],
        shutdownDelayMs: SHUTDOWN_DELAY_MS,
      }),
    }),
    ...ROUTE_MODULES,
  ],
})
export class AppModule {}
