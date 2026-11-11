import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { loadAppConfig } from './config/app-config.js';

const config = loadAppConfig(process.env);
const app = await NestFactory.create(AppModule);
// The deployment starts the new version next to the old one, then stops the old one: the stop must
// close open connections instead of cutting them.
app.enableShutdownHooks();
await app.listen(config.port);
