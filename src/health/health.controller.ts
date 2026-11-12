import { Controller, Get } from '@nestjs/common';

/** Body returned by the health routes. */
export interface HealthStatus {
  /** Always `ok`: an unhealthy process does not answer. */
  readonly status: 'ok';
}

/**
 * Liveness and readiness routes probed by the container healthcheck.
 *
 * Bootstrap placeholder: it answers as soon as the process listens and checks no dependency. The
 * health module of `@cadenway/nest-common` (Redis reachable) replaces it once that package is
 * published.
 */
@Controller('health')
export class HealthController {
  /** Tells the orchestrator that the process is running. */
  @Get('live')
  live(): HealthStatus {
    return { status: 'ok' };
  }

  /** Tells the orchestrator that the gateway accepts requests. */
  @Get('ready')
  ready(): HealthStatus {
    return { status: 'ok' };
  }
}
