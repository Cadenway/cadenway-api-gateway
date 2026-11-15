// Preloaded before main.js, so that the OpenTelemetry instrumentations patch http, Express,
// ioredis and fetch before the application imports them:
//
//   node --experimental-loader=@cadenway/nest-common/hook.mjs --import ./dist/telemetry.js dist/main.js
//
// The flags belong to the start command (the CMD of the Dockerfile, `pnpm start:dev`), never to
// application code. Traces and metrics are exported to OTEL_EXPORTER_OTLP_ENDPOINT; unset, spans
// still give the logs their trace ids and nothing leaves the process. The version comes from the
// package.json next to dist/.
import { startTelemetry } from '@cadenway/nest-common/telemetry';

startTelemetry({ service: 'api-gateway' });
