import { loadConfig, runApplication } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { appConfigSchema, type AppConfig } from './config/app-config.js';
import { createGatewayApplication, SERVICE_NAME } from './gateway-application.js';

// Started after `telemetry.js` (see `telemetry.ts`). Whatever fails before the gateway listens (an
// invalid environment, a port in use) is written by `runApplication` as one JSON line on the
// standard error, and the process exits with code 1.
await runApplication({ service: SERVICE_NAME }, async (): Promise<void> => {
  // Read here, before the application exists: the logger and the internal token signer that
  // `createApplication` installs need it. The same validated value is provided to the modules
  // under `CONFIG`: the environment is validated once.
  const config: Readonly<AppConfig> = loadConfig(appConfigSchema);
  const app: NestExpressApplication = await createGatewayApplication(config);
  await app.listen(config.PORT);
});
