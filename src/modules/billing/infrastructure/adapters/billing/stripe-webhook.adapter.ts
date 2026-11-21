import { ProblemException } from '@cadenway/nest-common';

import type { StripeWebhookDelivery } from '../../../application/models/billing/stripe-webhook-delivery.model.js';
import type { StripeWebhookPort } from '../../../application/ports/outbound/billing/stripe-webhook/stripe-webhook.port.js';

/** The technical client's generated Stripe operation. */
interface BillingWebhookClient {
  // #region Methods
  /** Sends one provider delivery to Billing. */
  receiveStripeWebhook(input: StripeWebhookDelivery): Promise<void>;
  // #endregion
}

/** Relays a Stripe request without retaining upstream details in public errors. */
export function createStripeWebhookAdapter(client: BillingWebhookClient): StripeWebhookPort {
  return {
    async receive(input) {
      try {
        await client.receiveStripeWebhook(input);
      } catch (error) {
        if (error instanceof ProblemException) {
          const { code, status } = error.problem;
          if (
            (status === 400 &&
              [
                'billing.invalid-webhook-signature',
                'billing.invalid-webhook',
                'request.body-too-large',
              ].includes(code)) ||
            (status === 503 &&
              [
                'billing.unavailable',
                'upstream.failed',
                'upstream.unauthorized',
                'upstream.unreachable',
                'upstream.timeout',
                'upstream.unavailable',
                'upstream.circuit-open',
                'upstream.deadline-exceeded',
              ].includes(code))
          ) {
            throw new ProblemException({ status, code });
          }
          if (status === 401 || status === 403) {
            throw new ProblemException({ status: 503, code: 'upstream.unauthorized' });
          }
        }
        throw new ProblemException({ status: 503, code: 'upstream.failed' });
      }
    },
  };
}
