import { ReceiveStripeBillingWebhookHeader } from '@cadenway/contracts/validators/public/billing';
import { ProblemException } from '@cadenway/nest-common';
import { Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { WebhookRateLimitGuard } from '../../../../../rate-limit/public/requests/webhook-rate-limit-guard.js';
import { ReceiveStripeWebhook } from '../../../../application/use-cases/commands/billing/receive-stripe-webhook/receive-stripe-webhook.use-case.js';

/** Public Stripe deliveries are forwarded to Billing for verification. */
@Controller('v1/billing/webhooks')
@UseGuards(CredentialGuard, WebhookRateLimitGuard)
export class StripeWebhookController {
  // #region Constructor
  /** Binds the raw delivery relay. */
  public constructor(
    @Inject(ReceiveStripeWebhook) private readonly receive: ReceiveStripeWebhook,
  ) {}
  // #endregion

  // #region Methods
  /** Forwards one original Stripe delivery without interpreting its body. */
  @Post('stripe')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'receiveStripeBillingWebhook',
    security: [],
    organization: false,
  })
  @WebhookRateLimitGuard.provider('stripe')
  public async stripe(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const signatures = request.headersDistinct['stripe-signature'];
    const signature = ReceiveStripeBillingWebhookHeader.shape['Stripe-Signature'].safeParse(
      signatures?.length === 1 ? signatures[0] : signatures,
    );
    if (!signature.success) {
      throw new ProblemException({ status: 400, code: 'billing.invalid-webhook-signature' });
    }
    if (!request.is('application/json') || !Buffer.isBuffer(request.body)) {
      throw new ProblemException({ status: 400, code: 'billing.invalid-webhook' });
    }
    await this.receive.execute({ body: request.body, signature: signature.data });
    response.setHeader('Cache-Control', 'private, no-store');
  }
  // #endregion
}
