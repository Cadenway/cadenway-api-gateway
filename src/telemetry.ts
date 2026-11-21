// Preloaded before main.js, so that the OpenTelemetry instrumentations patch http, Express,
// ioredis and fetch before the application imports them:
//
//   node --max-old-space-size=160 --import @cadenway/nest-common/register --import ./dist/telemetry.js dist/main.js
//
// `@cadenway/nest-common/register` registers the module hooks of the instrumentations first, which
// is why it comes before this file. The flags belong to the start command (the CMD of the
// Dockerfile, `pnpm start:dev`), never to application code. Traces and metrics are exported to OTEL_EXPORTER_OTLP_ENDPOINT; unset, spans
// still give the logs their trace ids and nothing leaves the process. The version comes from the
// package.json next to dist/.
import { startTelemetry } from '@cadenway/nest-common/telemetry';

startTelemetry({
  service: 'api-gateway',
  sensitiveHttpPathPrefixes: [
    '/v1/intake-forms/',
    '/internal/v1/intake-forms/',
    '/v1/inbox/',
    '/internal/v1/inbox/',
    '/v1/members/',
    '/internal/v1/avatars/',
    '/internal/v1/organization/logo-assets/',
    '/internal/v1/profile-media-uploads/',
  ],
});
