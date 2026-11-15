import { ConfigModule, HealthModule, type HealthModuleOptions } from '@cadenway/nest-common';
import { Module } from '@nestjs/common';

import { appConfigSchema } from './config/app-config.js';
import { RateLimitModule, RedisConnection } from './rate-limit/rate-limit.module.js';

/**
 * Class AppModule
 *
 * @description
 * Root module of the gateway, wrapped by `createApplication` of `@cadenway/nest-common`, which
 * adds the logs, the error format, the validation pipe, the interceptors, the body limit and the
 * request deadline.
 *
 * - `ConfigModule` validates the environment against `appConfigSchema` while this module is
 *   declared, so an invalid environment stops the process before anything is created, and
 *   provides it under `CONFIG`.
 * - `HealthModule` serves `GET /health/live`, which checks nothing, and `GET /health/ready`, which
 *   answers 503 while Redis does not answer `PING` within one second. Both are what the container
 *   healthcheck and the deployment probe.
 *
 * The modules of `src/auth/`, `src/routes/`, `src/aggregates/`, `src/public/` and `src/clients/`
 * are registered here as they are created.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ schema: appConfigSchema }),
    RateLimitModule,
    HealthModule.forRootAsync({
      inject: [RedisConnection],
      useFactory: (redis: RedisConnection): HealthModuleOptions => ({
        indicators: [redis.healthIndicator()],
      }),
    }),
  ],
})
export class AppModule {}
