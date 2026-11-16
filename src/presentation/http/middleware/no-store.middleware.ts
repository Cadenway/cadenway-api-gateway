import type { NextFunction, Request, Response } from 'express';

/**
 * Function noStore
 *
 * @description
 * Sets `Cache-Control: no-store` before the route runs, so that every answer of a route about
 * the session, its errors included, stays out of the browser and proxy caches: the routes that
 * sign in and `GET /v1/me` must carry it (`openapi/public/auth.yaml`), and the other routes of
 * the authentication answer about an address or a code.
 *
 * @param {Request} _request - Incoming request.
 * @param {Response} response - Response of the request.
 * @param {NextFunction} next - Continues with the route.
 */
export function noStore(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}
