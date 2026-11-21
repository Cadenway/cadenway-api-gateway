import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { StripeWebhookDelivery } from '../../../../application/ports/outbound/billing/stripe-webhook/stripe-webhook.port.js';
import { ReceiveStripeWebhook } from '../../../../application/use-cases/commands/billing/receive-stripe-webhook/receive-stripe-webhook.use-case.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';

const payload = Buffer.from('\n{ "message": "écran" }\n');
const signature = 't=12345,v1=synthetic-signature';

function request(signatures: string[] | undefined, body: unknown = payload): Request {
  return {
    headersDistinct: { 'stripe-signature': signatures },
    body,
    is: (type: string) => (type === 'application/json' ? type : false),
  } as unknown as Request;
}

describe('Stripe webhook controller', () => {
  it('forwards the original bytes and header exactly once', async () => {
    const receive = vi
      .fn<(delivery: StripeWebhookDelivery) => Promise<void>>()
      .mockResolvedValue(undefined);
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;
    const controller = new StripeWebhookController(new ReceiveStripeWebhook({ receive }));

    await controller.stripe(request([signature]), response);

    expect(receive).toHaveBeenCalledExactlyOnceWith({ body: payload, signature });
    expect(receive.mock.calls[0]?.[0].body).toBe(payload);
    expect(setHeader).toHaveBeenCalledExactlyOnceWith('Cache-Control', 'private, no-store');
  });

  it.each([undefined, [], ['', 'other'], [signature, signature], [''], ['x'.repeat(4097)]])(
    'rejects an absent, repeated or oversized signature',
    async (signatures) => {
      const receive = vi.fn();
      const controller = new StripeWebhookController(new ReceiveStripeWebhook({ receive }));
      await expect(controller.stripe(request(signatures), {} as Response)).rejects.toMatchObject({
        problem: { status: 400, code: 'billing.invalid-webhook-signature' },
      });
      expect(receive).not.toHaveBeenCalled();
    },
  );

  it('rejects a decoded JSON body before contacting Billing', async () => {
    const receive = vi.fn();
    const controller = new StripeWebhookController(new ReceiveStripeWebhook({ receive }));
    await expect(controller.stripe(request([signature], {}), {} as Response)).rejects.toMatchObject(
      {
        problem: { status: 400, code: 'billing.invalid-webhook' },
      },
    );
    expect(receive).not.toHaveBeenCalled();
  });
});
