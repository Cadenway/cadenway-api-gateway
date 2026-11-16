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
    throw publicProblem({
      status: 403,
      code: 'auth.csrf-rejected',
      detail: 'Cross-site request refused.',
    });
  }
}
