import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from './app.module.js';
import { loadAppConfig } from './config/app-config.js';
import type { AppConfig } from './config/app-config.js';

/**
 * Constant config
 *
 * @description
 * Validated configuration for the service process.
 *
 * @type {AppConfig}
 */
const config: AppConfig = loadAppConfig(process.env);
/**
 * Constant app
 *
 * @description
 * Nest application serving the public HTTP API.
 *
 * @type {INestApplication}
 */
const app: INestApplication = await NestFactory.create(AppModule);
// The deployment starts the new version next to the old one, then stops the old one: the stop must
// close open connections instead of cutting them.
app.enableShutdownHooks();
await app.listen(config.port);
