import type { NextFunction, Request, Response } from 'express';

/**
 * Function noStore
 *
 * @description
 * Sets `Cache-Control: no-store` for routes that handle sensitive data, including errors.
 * Authentication and public intake use it to keep responses out of browser and proxy caches.
 *
 * @param {Request} _request - Incoming request.
 * @param {Response} response - Response of the request.
 * @param {NextFunction} next - Continues with the route.
 */
export function noStore(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}
