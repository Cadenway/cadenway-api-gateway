import { Module } from '@nestjs/common';

import { HealthController } from './health/health.controller.js';

/**
 * Root module of the gateway.
 *
 * The modules of `src/auth/`, `src/rate-limit/`, `src/routes/`, `src/aggregates/`, `src/public/` and
 * `src/clients/` are registered here as they are created. The health controller is a bootstrap
 * placeholder until `@waypoint/nest-common` provides the health module.
 */
@Module({ controllers: [HealthController] })
export class AppModule {}
