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
import type { WebhookProvider } from '../../../../application/models/requests/webhook-provider.model.js';
import {
  CountWebhookRequest,
  WEBHOOK_REQUESTS_PER_MINUTE,
} from '../../../../application/use-cases/commands/addresses/count-webhook-request/count-webhook-request.use-case.js';

const WEBHOOK_PROVIDER = Symbol('webhook-provider');

/** Enforces independent per-address quotas on public webhook routes. */
@Injectable()
export class WebhookRateLimitGuard implements CanActivate {
  // #region Constructor
  /** Receives the webhook counter and route metadata reader. */
  public constructor(
    @Inject(CountWebhookRequest) private readonly counter: CountWebhookRequest,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  // #endregion

  // #region Methods
  /** Assigns the fixed provider quota to a webhook handler. */
  public static provider(provider: WebhookProvider): CustomDecorator<symbol> {
    return SetMetadata(WEBHOOK_PROVIDER, provider);
  }

  /** Counts the proxy-resolved client address before validating the delivery. */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const provider = this.reflector.get<WebhookProvider | undefined>(
      WEBHOOK_PROVIDER,
      context.getHandler(),
    );
    if (provider === undefined) {
      throw new Error('Webhook rate limit provider is not configured.');
    }
    const request = context.switchToHttp().getRequest<Request>();
    const allowance = await this.counter.execute(toClientAddress(request), provider);
    if (!allowance.allowed) {
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('Retry-After', String(allowance.retryAfterSeconds));
      response.setHeader('RateLimit', `"${provider}";r=0;t=${String(allowance.retryAfterSeconds)}`);
      response.setHeader(
        'RateLimit-Policy',
        `"${provider}";q=${String(WEBHOOK_REQUESTS_PER_MINUTE)};w=60`,
      );
      throw anonymousRateLimitExceededProblem();
    }
    return true;
  }
  // #endregion
}
