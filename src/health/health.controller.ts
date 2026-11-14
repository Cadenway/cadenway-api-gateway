import { Controller, Get } from '@nestjs/common';

/**
 * Interface HealthStatus
 *
 * @description
 * Body returned by the health routes.
 */
export interface HealthStatus {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Always `ok`: an unhealthy process does not answer.
   *
   * @type {'ok'}
   * @readonly
   */
  readonly status: 'ok';
  // #endregion
}

/**
 * Class HealthController
 *
 * @description
 * Liveness and readiness routes probed by the container healthcheck.
 *
 * Bootstrap placeholder: it answers as soon as the process listens and checks no dependency. The
 * health module of `@cadenway/nest-common` (Redis reachable) replaces it once that
 * package is published.
 */
@Controller('health')
export class HealthController {
  // #region Methods
  /**
   * Method live
   *
   * @description
   * Tells the orchestrator that the process is running.
   *
   * @returns {HealthStatus} The liveness status.
   */
  @Get('live')
  public live(): HealthStatus {
    return { status: 'ok' };
  }

  /**
   * Method ready
   *
   * @description
   * Tells the orchestrator that the gateway accepts requests.
   *
   * @returns {HealthStatus} The readiness status.
   */
  @Get('ready')
  public ready(): HealthStatus {
    return { status: 'ok' };
  }
  // #endregion
}
