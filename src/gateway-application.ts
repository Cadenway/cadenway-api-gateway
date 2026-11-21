import { randomUUID } from 'node:crypto';
import {
  createApplication,
  type CreateApplicationOptions,
  ProblemException,
  REQUEST_ID_HEADER,
  toProblem,
} from '@cadenway/nest-common';
import type { DynamicModule, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app-config.js';
import { noStore } from './presentation/http/middleware/no-store.middleware.js';
import { siteFormProblem } from './problems/public-problem.js';

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
 * concurrency, idempotency and applicant draft headers of the contracts. `Authorization` is
 * absent on purpose: the applications authenticate with the session cookie, and API tokens are
 * not used from a browser.
 *
 * @type {readonly string[]}
 */
export const CORS_ALLOWED_HEADERS: readonly string[] = [
  'Content-Type',
  'If-Match',
  'If-Organization-Match',
  'Idempotency-Key',
  'Intake-Draft-Key',
];

/**
 * Constant CORS_EXPOSED_HEADERS
 *
 * @description
 * Response headers of the contracts the applications must be able to read across origins: the
 * error reference, the entity tag, the location of a created resource, the download filename,
 * the rate limit, the idempotent replay and the deprecation notices.
 *
 * @type {readonly string[]}
 */
export const CORS_EXPOSED_HEADERS: readonly string[] = [
  'X-Request-Id',
  'ETag',
  'Location',
  'Content-Disposition',
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

// A capture-free path prevents Express decoding an invalid member ID before setting the header.
const PROFILE_MEDIA_PATH =
  /^\/v1\/(?:(?:me\/avatar|organization\/logo)(?:\/uploads)?|members\/[^/]+\/avatar)\/?$/iu;
const DOCUMENTS_PATH = /^\/v1\/documents(?:\/[^/]+)?\/?$/iu;
// All routes addressed by a task key, plus the bulk actions and current-organization collections.
const ORGANIZATION_BOUND_PATH =
  /^\/v1\/(?:tasks\/[^/]+(?:\/[^/]+)*|organization(?:\/authentication-policy)?|archives\/(?:lists|tasks)|trash\/(?:empty|entries(?:\/[^/]+(?:\/restore)?)?))\/?$/iu;
const SEARCH_PATH = /^\/v1\/search\/?$/iu;
const BILLING_PRIVATE_PATH = /^\/v1\/billing\/(?:subscription|checkout|invoices)\/?$/iu;
const FEDERATED_AUTH_PATH =
  /^\/v1\/auth\/sign-in\/federated\/(?:start|finish|saml\/callback|providers\/[^/]+\/callback)\/?$/iu;
const SAML_CALLBACK_PATH = /^\/v1\/auth\/sign-in\/federated\/saml\/callback\/?$/iu;
const FEDERATED_CALLBACK_PATH = /\/callback\/?$/iu;
const AUTOMATIONS_PATH = /^\/v1\/(?:automations(?:\/[^/]+)?|automation-runs)\/?$/iu;
const STRIPE_WEBHOOK_PATH = '/v1/billing/webhooks/stripe';
const SIGNED_WEBHOOK_PATH =
  /^\/v1\/(?:webhooks\/(?:github|gitlab)|billing\/webhooks\/stripe)\/?$/iu;
const STRIPE_WEBHOOK_ERROR_PATH = /^\/v1\/billing\/webhooks\/stripe\/?$/iu;
const SITE_SUBMISSION_PATH = /^\/v1\/(?:contact-submissions|newsletter-subscriptions)\/?$/iu;

/** Sets the private cache policy before guards, parsing errors and the route response. */
function noStorePrivateResource(
  request: Request,
  response: Response,
  next: NextFunction,
  pathParameter: 'memberId' | 'documentId',
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  try {
    decodeURI(request.originalUrl.split('?', 1)[0] ?? '');
  } catch {
    next(
      new ProblemException({
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [
            {
              in: 'path',
              path: pathParameter,
              code: 'invalid_format',
              message: 'Invalid path encoding.',
            },
          ],
        },
      }),
    );
    return;
  }
  next();
}

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
 * - Express trusts one proxy hop, Traefik, and computes no entity tag of its own.
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
  const cors = {
    origin: [...config.ALLOWED_ORIGINS],
    credentials: true,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    maxAge: CORS_MAX_AGE_SECONDS,
  };
  const app: NestExpressApplication = await createApplication(applicationModule, {
    service: SERVICE_NAME,
    config,
    provideConfig: true,
    rawJsonPostPaths: ['/v1/webhooks/github', '/v1/webhooks/gitlab', STRIPE_WEBHOOK_PATH],
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
  app.use(SITE_SUBMISSION_PATH, noStore);
  app.use(
    SITE_SUBMISSION_PATH,
    (error: unknown, request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader(REQUEST_ID_HEADER, randomUUID());
      // A parser error skips the regular CORS middleware.
      response.vary('Origin');
      const origin = request.get('Origin');
      if (origin !== undefined && cors.origin.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Credentials', String(cors.credentials));
        response.setHeader('Access-Control-Expose-Headers', cors.exposedHeaders.join(','));
      }
      const problem = toProblem(error);
      if (
        problem.status === 400 &&
        problem.code !== 'request.invalid' &&
        problem.code !== 'request.body-too-large'
      ) {
        next(
          siteFormProblem(
            new ProblemException({
              status: 400,
              code: 'request.invalid',
              details: { issues: [{ in: 'body', path: '', code: 'invalid_format' }] },
            }),
          ),
        );
        return;
      }
      next(siteFormProblem(error));
    },
  );
  app.use(
    SIGNED_WEBHOOK_PATH,
    (_request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'private, no-store');
      next();
    },
  );
  app.use(
    STRIPE_WEBHOOK_ERROR_PATH,
    (error: unknown, _request: Request, _response: Response, next: NextFunction): void => {
      // The raw parser rejects encoded bodies before controller validation. The public
      // webhook contract represents unsupported media as an opaque 400.
      const problem = toProblem(error);
      if (
        !(error instanceof ProblemException) &&
        (problem.status === 415 ||
          (problem.status === 400 && problem.code !== 'request.body-too-large'))
      ) {
        next(new ProblemException({ status: 400, code: 'billing.invalid-webhook' }));
        return;
      }
      next(error);
    },
  );
  app.use(
    SIGNED_WEBHOOK_PATH,
    (error: unknown, _request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'private, no-store');
      next(error);
    },
  );
  app.use(PROFILE_MEDIA_PATH, (request: Request, response: Response, next: NextFunction): void => {
    noStorePrivateResource(request, response, next, 'memberId');
  });
  app.use(DOCUMENTS_PATH, (request: Request, response: Response, next: NextFunction): void => {
    if (request.method === 'GET' || request.method === 'HEAD') {
      delete request.headers['if-none-match'];
      delete request.headers['if-modified-since'];
    }
    noStorePrivateResource(request, response, next, 'documentId');
  });
  // Keep the numeric ETag available to If-Match writes. It is not a validator of a cached
  // representation: the same URL and version can refer to different organizations.
  app.use(
    [ORGANIZATION_BOUND_PATH, SEARCH_PATH, BILLING_PRIVATE_PATH, AUTOMATIONS_PATH],
    (request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'private, no-store');
      if (request.method === 'GET' || request.method === 'HEAD') {
        delete request.headers['if-none-match'];
        delete request.headers['if-modified-since'];
      }
      next();
    },
  );
  app.use(
    [
      ORGANIZATION_BOUND_PATH,
      PROFILE_MEDIA_PATH,
      DOCUMENTS_PATH,
      SEARCH_PATH,
      BILLING_PRIVATE_PATH,
      AUTOMATIONS_PATH,
    ],
    (error: unknown, _request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'private, no-store');
      const problem = toProblem(error);
      if (
        error instanceof ProblemException ||
        problem.status !== 400 ||
        problem.code === 'request.body-too-large'
      ) {
        next(error);
        return;
      }
      next(
        new ProblemException({
          status: 400,
          code: 'request.invalid',
          details: {
            issues: [
              { in: 'body', path: '', code: 'invalid_format', message: 'Invalid JSON body.' },
            ],
          },
        }),
      );
    },
  );
  // Nest route middleware is skipped when the shared parser reports a malformed body.
  app.use(
    [
      '/v1/intake-forms',
      '/v1/inbox',
      '/v1/reminders',
      '/v1/tasks/:taskKey/reminder',
      '/v1/me/notification-preferences',
      '/v1/realtime/tickets',
    ],
    (error: unknown, request: Request, response: Response, next: NextFunction): void => {
      noStore(request, response, () => {
        next(error);
      });
    },
  );
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
  // The only entity tag is the `version` of a resource, set by the `EtagInterceptor` of the kit:
  // Express would add a weak one, derived from the body, to every other answer.
  app.set('etag', false);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors(cors);
  app.use(FEDERATED_AUTH_PATH, (request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('Cache-Control', 'private, no-store');
    if (FEDERATED_CALLBACK_PATH.test(request.originalUrl.split('?', 1)[0] ?? '')) {
      response.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  });
  app.useBodyParser('text', {
    type: (request) =>
      request.method === 'POST' &&
      SAML_CALLBACK_PATH.test(request.url?.split('?', 1)[0] ?? '') &&
      /^application\/x-www-form-urlencoded(?:\s*;|$)/iu.test(request.headers['content-type'] ?? ''),
    limit: 790 * 1024,
    inflate: false,
  });
  app.use(
    FEDERATED_AUTH_PATH,
    (error: unknown, request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'private, no-store');
      if (FEDERATED_CALLBACK_PATH.test(request.originalUrl.split('?', 1)[0] ?? '')) {
        response.setHeader('Referrer-Policy', 'no-referrer');
      }
      if (error instanceof ProblemException) {
        next(error);
        return;
      }
      next(
        new ProblemException({
          status: 400,
          code: 'request.invalid',
          details: { issues: [{ in: 'body', path: '', code: 'invalid_format' }] },
        }),
      );
    },
  );
  return app;
}
