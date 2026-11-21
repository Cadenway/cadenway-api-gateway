import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { anonymousRateLimitExceededProblem } from '../../../../../../problems/credential-problems.js';
import { toClientAddress } from '../../../../../../presentation/http/mappers/client-address.mapper.js';
import type { SiteOperation } from '../../../../application/models/requests/site-operation.model.js';
import {
  CountSiteRequest,
  SITE_REQUEST_QUOTAS,
} from '../../../../application/use-cases/commands/addresses/count-site-request/count-site-request.use-case.js';

const SITE_OPERATION = Symbol('site-operation');

/** Limits each public form separately by its proxy-resolved client network. */
@Injectable()
export class SiteRateLimitGuard implements CanActivate {
  // #region Constructor
  /** Binds the counter and declared route operation. */
  public constructor(
    @Inject(CountSiteRequest) private readonly counter: CountSiteRequest,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  // #endregion

  // #region Methods
  /** Selects the operation quota. */
  public static operation(operation: SiteOperation): CustomDecorator<symbol> {
    return SetMetadata(SITE_OPERATION, operation);
  }

  /** Counts before validation or an upstream call. */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const operation = this.reflector.get<SiteOperation | undefined>(
      SITE_OPERATION,
      context.getHandler(),
    );
    if (operation === undefined) throw new Error('Site rate limit operation is not configured.');
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    const request = context.switchToHttp().getRequest<Request>();
    const allowance = await this.counter.execute(toClientAddress(request), operation);
    response.setHeader(
      'RateLimit-Policy',
      `"${operation}";q=${String(SITE_REQUEST_QUOTAS[operation])};w=60`,
    );
    if (!allowance.allowed) {
      response.setHeader('Retry-After', String(allowance.retryAfterSeconds));
      response.setHeader(
        'RateLimit',
        `"${operation}";r=0;t=${String(allowance.retryAfterSeconds)}`,
      );
      throw anonymousRateLimitExceededProblem();
    }
    return true;
  }
  // #endregion
}
