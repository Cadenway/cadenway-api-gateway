import { CONFIG } from '@cadenway/nest-common';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AppConfig } from '../config/app-config.js';
import { assertSameSiteRequest, isUnsafeMethod } from './cross-site.js';

/**
 * Class CsrfGuard
 *
 * @description
 * Refuses an unsafe request whose `Origin` is not exactly an allowed origin or whose
 * `Content-Type` is not `application/json`, with `403 auth.csrf-rejected`, before the route runs
 * (see `assertSameSiteRequest`). Safe methods pass.
 *
 * It guards the routes that carry no session yet, the sign-up and sign-in flows of
 * `openapi/public/auth.yaml` (decision 6 of the walking skeleton, against login cross-site request
 * forgery). A route authenticated by the session cookie gets the same check from `SessionGuard`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  // #region Properties
  /**
   * Property allowedOrigins
   *
   * @description
   * `ALLOWED_ORIGINS` of the configuration, the origins CORS answers.
   *
   * @type {readonly string[]}
   * @readonly
   */
  private readonly allowedOrigins: readonly string[];
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the allowed origins from the validated configuration.
   *
   * @param {AppConfig} config - Validated configuration of the gateway.
   * @constructor
   */
  public constructor(@Inject(CONFIG) config: AppConfig) {
    this.allowedOrigins = config.ALLOWED_ORIGINS;
  }
  // #endregion

  // #region Methods
  /**
   * Method canActivate
   *
   * @description
   * Applies the cross-site check to an unsafe request.
   *
   * @param {ExecutionContext} context - Execution context of the request.
   * @returns {boolean} `true` when the request may continue.
   * @throws {ProblemException} 403 `auth.csrf-rejected`.
   */
  public canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest<Request>();
    if (isUnsafeMethod(request.method)) {
      assertSameSiteRequest(request, this.allowedOrigins);
    }
    return true;
  }
  // #endregion
}
