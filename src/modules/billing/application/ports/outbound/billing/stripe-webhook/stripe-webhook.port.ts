import type { StripeWebhookDelivery } from '../../../../models/billing/stripe-webhook-delivery.model.js';

/** The Billing-owned endpoint that verifies and accepts Stripe deliveries. */
export interface StripeWebhookPort {
  // #region Methods
  /** Forwards one delivery and resolves only after Billing accepts it. */
  receive(input: StripeWebhookDelivery): Promise<void>;
  // #endregion
}
