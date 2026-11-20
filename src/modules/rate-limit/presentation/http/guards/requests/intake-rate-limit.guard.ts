import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { anonymousRateLimitExceededProblem } from '../../../../../../problems/credential-problems.js';
import { toClientAddress } from '../../../../../../presentation/http/mappers/client-address.mapper.js';
import { CountIntakeRequest } from '../../../../application/use-cases/commands/addresses/count-intake-request/count-intake-request.use-case.js';

/** Enforces the public form's independent per-address read and submission limits. */
@Injectable()
export class IntakeRateLimitGuard implements CanActivate {
  // #region Constructor
  /** Receives the form request counter. */
  public constructor(@Inject(CountIntakeRequest) private readonly counter: CountIntakeRequest) {}
  // #endregion

  // #region Methods
  /** Counts the request before its body, key or destination is evaluated. */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const operation = request.method === 'GET' || request.method === 'HEAD' ? 'read' : 'submit';
    const allowance = await this.counter.execute(toClientAddress(request), operation);
    if (!allowance.allowed) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', String(allowance.retryAfterSeconds));
      throw anonymousRateLimitExceededProblem();
    }
    return true;
  }
  // #endregion
}
