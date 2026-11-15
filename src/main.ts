import { loadConfig } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { appConfigSchema } from './config/app-config.js';
import type { AppConfig } from './config/app-config.js';
import { createGatewayApplication } from './gateway-application.js';

/**
 * Constant config
 *
 * @description
 * Validated configuration of the process. A missing or invalid variable throws a `ConfigError`
 * naming it, and the process exits before it listens.
 *
 * @type {Readonly<AppConfig>}
 */
const config: Readonly<AppConfig> = loadConfig(appConfigSchema);

/**
 * Constant app
 *
 * @description
 * The gateway, serving the public HTTP API behind Traefik. Telemetry is already running: the start
 * command preloads `telemetry.js` before this module (see `telemetry.ts`).
 *
 * @type {NestExpressApplication}
 */
const app: NestExpressApplication = await createGatewayApplication(config);

await app.listen(config.PORT);
