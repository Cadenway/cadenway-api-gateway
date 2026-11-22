import { ProblemException } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import type { StripeWebhookDelivery } from '../../../application/models/billing/stripe-webhook-delivery.model.js';
import { createStripeWebhookAdapter } from './stripe-webhook.adapter.js';

const input = { body: Buffer.from('\n{ "event": "synthetic" }\n'), signature: 't=1,v1=fixture' };

describe('Stripe webhook adapter', () => {
  it('forwards the exact delivery once', async () => {
    const receiveStripeWebhook = vi
      .fn<(delivery: StripeWebhookDelivery) => Promise<void>>()
      .mockResolvedValue(undefined);
    await createStripeWebhookAdapter({ receiveStripeWebhook }).receive(input);
    expect(receiveStripeWebhook).toHaveBeenCalledExactlyOnceWith(input);
    expect(receiveStripeWebhook.mock.calls[0]?.[0].body).toBe(input.body);
  });

  it.each([
    { status: 400, code: 'billing.invalid-webhook-signature' },
    { status: 400, code: 'billing.invalid-webhook' },
    { status: 400, code: 'request.body-too-large' },
    { status: 503, code: 'billing.unavailable' },
    { status: 503, code: 'upstream.timeout' },
  ] as const)('reconstructs public $code without provider details', async ({ status, code }) => {
    const receiveStripeWebhook = vi
      .fn()
      .mockRejectedValue(new ProblemException({ status, code, detail: 'private upstream data' }));
    const caught: unknown = await createStripeWebhookAdapter({ receiveStripeWebhook })
      .receive(input)
      .catch((error: unknown) => error);
    expect(caught).toMatchObject({ problem: { status, code } });
    expect(JSON.stringify(caught)).not.toContain('private upstream data');
  });

  it('maps internal authentication and unexpected failures to opaque 503 responses', async () => {
    const receiveStripeWebhook = vi
      .fn()
      .mockRejectedValue(new ProblemException({ status: 403, code: 'auth.actor-not-allowed' }));
    const adapter = createStripeWebhookAdapter({ receiveStripeWebhook });
    await expect(adapter.receive(input)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.unauthorized' },
    });
    receiveStripeWebhook.mockRejectedValue(new Error('private provider data'));
    const caught: unknown = await adapter.receive(input).catch((error: unknown) => error);
    expect(caught).toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(JSON.stringify(caught)).not.toContain('private provider data');
  });
});
