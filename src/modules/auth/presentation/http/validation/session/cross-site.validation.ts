import type { ProblemException } from '@cadenway/nest-common';
import type { Request } from 'express';

import { publicProblem } from '../../../../../../problems/public-problem.js';

/**
 * Constant SAFE_METHODS
 *
 * @description
 * Methods RFC 9110 defines as safe, which change nothing: every other method, `POST`, `PUT`,
 * `PATCH` and `DELETE` included, gets the cross-site check, so a method nobody listed cannot skip
 * it.
 *
 * @type {ReadonlySet<string>}
 */
const SAFE_METHODS: ReadonlySet<string> = new Set<string>(['GET', 'HEAD', 'OPTIONS']);

/**
 * Constant JSON_MEDIA_TYPE
 *
 * @description
 * The only media type an unsafe request may carry. A browser sends it cross-site only after a
 * CORS preflight, which answers the allowed origins only; an HTML form cannot send it at all.
 *
 * @type {string}
 */
const JSON_MEDIA_TYPE: string = 'application/json';

/**
 * Function isUnsafeMethod
 *
 * @description
 * Tells whether a request method changes something.
 *
 * @param {string} method - Method of the request, as Express reads it (uppercase).
 * @returns {boolean} `false` for `GET`, `HEAD` and `OPTIONS`, `true` for every other method.
 */
export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Function isJsonContentType
 *
 * @description
 * Compares the media type of `Content-Type`, without its parameters and case, to
 * `application/json`: `application/json; charset=utf-8` passes, `text/plain` and
 * `application/json-patch+json` do not.
 *
 * @param {string | undefined} contentType - `Content-Type` header of the request.
 * @returns {boolean} `true` when the body is declared as JSON.
 */
function isJsonContentType(contentType: string | undefined): boolean {
  const mediaType: string | undefined = contentType?.split(';', 1)[0];
  return mediaType?.trim().toLowerCase() === JSON_MEDIA_TYPE;
}

/**
 * Function assertSameSiteRequest
 *
 * @description
 * The cross-site check of an unsafe request: its `Origin` must be exactly one of the allowed
 * origins (the web application and the website, compared as strings, as CORS compares them) and
 * its `Content-Type` must be `application/json`. A request without `Origin`, with `Origin: null`
 * or with several `Origin` headers (Node joins them) fails. It runs before the route, so a refused
 * request reaches neither identity-service nor the controller.
 *
 * The rules of the gateway require it on every unsafe request the session cookie authenticates;
 * the login cross-site decision (docs/integration.md) also requires it on every unsafe route of
 * `openapi/public/auth.yaml`, signed in or not, against login cross-site request forgery.
 *
 * @param {Request} request - Incoming request.
 * @param {readonly string[]} allowedOrigins - `ALLOWED_ORIGINS` of the configuration.
 * @throws {ProblemException} 403 `auth.csrf-rejected` when the request fails the check.
 */
export function assertSameSiteRequest(request: Request, allowedOrigins: readonly string[]): void {
  const origin: string | undefined = request.get('Origin');
  if (
    origin === undefined ||
    !allowedOrigins.includes(origin) ||
    !isJsonContentType(request.get('Content-Type'))
  ) {
    throw crossSiteRefused();
  }
}

/**
 * Function hasBody
 *
 * @description
 * Tells whether a request carries a body, as HTTP/1.1 frames one (RFC 9112): a
 * `Transfer-Encoding`, or a `Content-Length` other than `0`.
 *
 * @param {Request} request - Incoming request.
 * @returns {boolean} `true` when a body follows the headers.
 */
function hasBody(request: Request): boolean {
  const length: string | undefined = request.get('Content-Length');
  return (
    request.get('Transfer-Encoding') !== undefined ||
    (length !== undefined && length.trim() !== '0')
  );
}

/**
 * Function assertCookieRequestSameSite
 *
 * @description
 * The cross-site check of an unsafe request authenticated by the session cookie. Its `Origin`
 * must be exactly one of the allowed origins, and:
 *
 * - a `DELETE` has no body: a browser sends one cross-site only after a CORS preflight, which
 *   answers the allowed origins only, so its `Origin` is the check (`openapi/public/members.yaml`,
 *   `openapi/public/api-tokens.yaml`); one that has a body or declares a media type must declare
 *   `application/json` all the same;
 * - every other unsafe request must carry `Content-Type: application/json`, as
 *   `openapi/public/organizations.yaml` and `openapi/public/auth.yaml` require (each of them has a
 *   JSON body in the contracts, so `members.yaml` and `api-tokens.yaml` agree). An explicitly
 *   declared bodyless POST also passes on its Origin when it has no body and no media type.
 *
 * A request authenticated by a personal API token carries no ambient credential and never comes
 * here.
 *
 * @param {Request} request - Incoming request.
 * @param {readonly string[]} allowedOrigins - `ALLOWED_ORIGINS` of the configuration.
 * @param {boolean} allowBodylessPost - Whether this POST's contract omits a request body.
 * @throws {ProblemException} 403 `auth.csrf-rejected` when the request fails the check.
 */
export function assertCookieRequestSameSite(
  request: Request,
  allowedOrigins: readonly string[],
  allowBodylessPost = false,
): void {
  const method = request.method.toUpperCase();
  if (method !== 'DELETE' && !(allowBodylessPost && method === 'POST')) {
    assertSameSiteRequest(request, allowedOrigins);
    return;
  }
  const origin: string | undefined = request.get('Origin');
  const contentType: string | undefined = request.get('Content-Type');
  if (origin === undefined || !allowedOrigins.includes(origin)) {
    throw crossSiteRefused();
  }
  if ((contentType !== undefined || hasBody(request)) && !isJsonContentType(contentType)) {
    throw crossSiteRefused();
  }
}

/**
 * Function crossSiteRefused
 *
 * @description
 * `403 auth.csrf-rejected`, with the English reason phrase as its title.
 *
 * @returns {ProblemException} The problem to throw.
 */
function crossSiteRefused(): ProblemException {
  return publicProblem({
    status: 403,
    code: 'auth.csrf-rejected',
    detail: 'Cross-site request refused.',
  });
}
