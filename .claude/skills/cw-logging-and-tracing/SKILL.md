---
name: cw-logging-and-tracing
description: "Log fields, redaction, trace propagation, the ESM start-up of OpenTelemetry and the metrics of cadenway-api-gateway. Load it before touching logging, tracing, metrics or the start command."
---

# Logging and tracing

The logger, the redaction list, the OpenTelemetry SDK, its instrumentations and its exporters
belong to `@cadenway/nest-common`: the gateway configures them and installs no logging or telemetry
library of its own. `createApplication` (called by `src/gateway-application.ts`) installs the logs,
and `src/telemetry.ts` starts the telemetry. `pino-pretty` is the one exception, a
development dependency for readable local output. Check what the installed kit exports before relying
on a name.

## Logs

- JSON lines from the logger of `@cadenway/nest-common`; never `console.log`.
- Fields: `service`, `version`, `traceId`, `spanId`, `organizationId`, `userId`, `route`, `status`,
  `durationMs`. `organizationId` and `userId` come from the verified token, never from the request.
- Redaction: tokens, passwords and e-mail addresses are masked by the list of the kit. No e-mail
  address and no IP address at `info` level.
- The session cookie, the `Authorization` header and the internal token never reach a log line.
- `LOG_LEVEL` sets the level; it is validated at start-up and described in `.env.example`.

## Traces

- W3C Trace Context: the incoming `traceparent` is continued, and every internal call carries it. The
  internal token carries the trace id too.
- SQL values and query strings are excluded from spans.
- An error response carries `X-Request-Id`, the reference the webapp displays.
- Spans come from the instrumentations of the kit (HTTP, Express, ioredis, undici) and its own NestJS
  interceptor. `@opentelemetry/instrumentation-nestjs-core` and `-router` stay out: the first does not
  support NestJS 12, the second doubles the spans under Express 5.

## Start-up (ESM)

The telemetry must be loaded before the application imports Express:

```text
node --experimental-loader=@cadenway/nest-common/hook.mjs --import ./dist/telemetry.js dist/main.js
```

- `src/telemetry.ts` only calls `startTelemetry` of `@cadenway/nest-common/telemetry`, which
  imports no NestJS code. The hook is named through the kit: pnpm's strict `node_modules` does not
  expose `@opentelemetry/instrumentation` to the application.
- This is the only documented way while NestJS 12 imports Express as ESM. Node 24 marks
  `--experimental-loader` as discouraged and prints an `ExperimentalWarning` on standard error at
  start-up: revisit the command with each Node or SDK upgrade.
- The flags go on the `node` start command (the `CMD` of the `Dockerfile` and `pnpm start:dev`),
  not in application code.
- `OTEL_EXPORTER_OTLP_ENDPOINT` points to the collector; `startTelemetry` refuses anything but an
  HTTP or HTTPS URL, and unset, nothing is exported. It is described in `.env.example` and stays out
  of `deploy/compose.yaml` until an environment has a collector.

## Metrics

- Per route: throughput, errors, duration. The label is the route pattern, never the URL, an id or a
  token.
- Exported over OTLP to the collector; no `prom-client`.
- The gateway has no outbox, no consumer and no database pool: those metrics belong to the services.
