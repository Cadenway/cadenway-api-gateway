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
import { CountIntakeRequest } from '../../../../application/use-cases/commands/addresses/count-intake-request/count-intake-request.use-case.js';

const ATTACHMENT_MUTATION = Symbol('intake-attachment-mutation');

/** Enforces independent per-address limits for public intake operations. */
@Injectable()
export class IntakeRateLimitGuard implements CanActivate {
  // #region Constructor
  /** Receives the form request counter. */
  public constructor(
    @Inject(CountIntakeRequest) private readonly counter: CountIntakeRequest,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  // #endregion

  // #region Methods
  /** Assigns an upload reservation, completion, or release to the attachment quota. */
  public static attachments(): CustomDecorator<symbol> {
    return SetMetadata(ATTACHMENT_MUTATION, true);
  }

  /** Counts the request before its body, key or destination is evaluated. */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const isAttachment = this.reflector.get<boolean>(ATTACHMENT_MUTATION, context.getHandler());
    const isRead = request.method === 'GET' || request.method === 'HEAD';
    const operation = isAttachment ? 'attachment' : isRead ? 'read' : 'submit';
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
