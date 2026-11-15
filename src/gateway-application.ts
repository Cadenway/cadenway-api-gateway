import { createApplication, type CreateApplicationOptions } from '@cadenway/nest-common';
import type { DynamicModule, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app-config.js';

/**
 * Constant SERVICE_NAME
 *
 * @description
 * Name of the gateway in its logs and traces.
 *
 * @type {string}
 */
export const SERVICE_NAME: string = 'api-gateway';

/**
 * Constant TRUSTED_PROXY_HOPS
 *
 * @description
 * Number of proxies in front of the gateway whose `X-Forwarded-*` headers Express trusts: Traefik,
 * and only Traefik. The client address and scheme are read from the hop Traefik adds; a header
 * the client wrote itself is never believed.
 *
 * @type {number}
 */
export const TRUSTED_PROXY_HOPS: number = 1;

/**
 * Constant CORS_ALLOWED_METHODS
 *
 * @description
 * Methods a browser may use on the API from an allowed origin.
 *
 * @type {readonly string[]}
 */
export const CORS_ALLOWED_METHODS: readonly string[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

/**
 * Constant CORS_ALLOWED_HEADERS
 *
 * @description
 * Request headers a browser may send beyond the CORS-safelisted ones: the JSON content type and the
 * concurrency and idempotency headers of the contracts. `Authorization` is absent on purpose: the
 * applications authenticate with the session cookie, and API tokens are not used from a browser.
 *
 * @type {readonly string[]}
 */
export const CORS_ALLOWED_HEADERS: readonly string[] = [
  'Content-Type',
  'If-Match',
  'Idempotency-Key',
];

/**
 * Constant CORS_EXPOSED_HEADERS
 *
 * @description
 * Response headers of the contracts the applications must be able to read across origins: the
 * error reference, the entity tag, the location of a created resource, the rate limit, the
 * idempotent replay and the deprecation notices.
 *
 * @type {readonly string[]}
 */
export const CORS_EXPOSED_HEADERS: readonly string[] = [
  'X-Request-Id',
  'ETag',
  'Location',
  'Retry-After',
  'RateLimit',
  'RateLimit-Policy',
  'Idempotent-Replayed',
  'Deprecation',
  'Sunset',
];

/**
 * Constant CORS_MAX_AGE_SECONDS
 *
 * @description
 * How long a browser may reuse a preflight answer, in seconds.
 *
 * @type {number}
 */
export const CORS_MAX_AGE_SECONDS: number = 600;

/**
 * Function createGatewayApplication
 *
 * @description
 * Creates the gateway with the shared formats of `@cadenway/nest-common` and the settings of a
 * public edge, ready to listen. `main.ts` calls it with the configuration of the process; the
 * tests call it with theirs, so all run the same start-up.
 *
 * - The configuration `main.ts` validated is provided globally under `CONFIG`
 *   (`provideConfig: true`): the environment is validated once, not again when the application is
 *   created.
 * - The internal token is signed for the calls the gateway makes (`INTERNAL_TOKEN_ISSUER`,
 *   `INTERNAL_TOKEN_PRIVATE_JWK`) and verified on none: the gateway authenticates the
 *   applications itself.
 * - An incoming `X-Request-Id` or `X-Request-Timeout-Ms` is ignored: a client chooses neither the
 *   reference of its request nor the budget of the internal calls.
 * - Express trusts one proxy hop, Traefik.
 * - `helmet` sets its default security headers; `cookie-parser` reads cookies, unsigned, since the
 *   session token is opaque and checked by identity-service.
 * - CORS answers the origins of `ALLOWED_ORIGINS` only, by exact comparison and with credentials.
 *   A preflight from any other origin gets no `Access-Control-Allow-Origin`, so the browser
 *   refuses the request.
 *
 * @param {Readonly<AppConfig>} config - Validated configuration of the gateway.
 * @param {CreateApplicationOptions['logDestination']} logDestination - Stream of the log lines;
 * the standard output when omitted. For tests.
 * @param {Type | DynamicModule} applicationModule - Root module; `AppModule` when omitted. For the
 * route tests, which serve the same routes with the internal services faked.
 * @returns {Promise<NestExpressApplication>} The application, not yet listening.
 */
export async function createGatewayApplication(
  config: Readonly<AppConfig>,
  logDestination?: CreateApplicationOptions['logDestination'],
  applicationModule: Type | DynamicModule = AppModule,
): Promise<NestExpressApplication> {
  const app: NestExpressApplication = await createApplication(applicationModule, {
    service: SERVICE_NAME,
    config,
    provideConfig: true,
    internalToken: {
      signer: {
        issuer: config.INTERNAL_TOKEN_ISSUER,
        privateJwk: config.INTERNAL_TOKEN_PRIVATE_JWK,
      },
    },
    internalTokenVerification: 'off',
    acceptIncomingRequestId: false,
    acceptIncomingRequestTimeout: false,
    logDestination,
  });
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [...config.ALLOWED_ORIGINS],
    credentials: true,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    maxAge: CORS_MAX_AGE_SECONDS,
  });
  return app;
}
