import type { StripeWebhookDelivery } from '../../../../models/billing/stripe-webhook-delivery.model.js';
import type { StripeWebhookPort } from '../../../../ports/outbound/billing/stripe-webhook/stripe-webhook.port.js';

/** Forwards a Stripe delivery to its Billing owner. */
export class ReceiveStripeWebhook {
  // #region Constructor
  /** Binds the Billing delivery port. */
  public constructor(private readonly webhook: StripeWebhookPort) {}
  // #endregion

  // #region Methods
  /** Forwards the original body and signature unchanged. */
  public execute(delivery: StripeWebhookDelivery): Promise<void> {
    return this.webhook.receive(delivery);
  }
  // #endregion
}
