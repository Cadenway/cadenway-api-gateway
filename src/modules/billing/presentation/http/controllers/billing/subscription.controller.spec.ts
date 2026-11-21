import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { GetSubscription } from '../../../../application/use-cases/queries/billing/get-subscription/get-subscription.use-case.js';
import { SubscriptionQueryPipe } from '../../validation/billing/subscription-query.validation.js';
import { SubscriptionController } from './subscription.controller.js';

describe('subscription controller', () => {
  it('projects the published response and marks it private', async () => {
    const read = vi.fn().mockResolvedValue({
      plan: 'free',
      seats: { used: 3, limit: 5, private: true },
      guestCount: 1,
      storage: { attachmentBytesUsed: 120, limitBytes: 2_000_000_000 },
      private: true,
    });
    const setHeader = vi.fn();
    const controller = new SubscriptionController(new GetSubscription({ read }));
    const response = { setHeader } as unknown as Response;

    await expect(controller.getSubscription({}, response)).resolves.toEqual({
      plan: 'free',
      seats: { used: 3, limit: 5 },
      guestCount: 1,
      storage: { attachmentBytesUsed: 120, limitBytes: 2_000_000_000 },
    });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('refuses unexpected query keys without echoing their names or values', () => {
    const pipe = new SubscriptionQueryPipe();
    expect(() => pipe.transform({ privateKey: 'privateValue' })).toThrow();
    try {
      pipe.transform({ privateKey: 'privateValue' });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('privateKey');
      expect(JSON.stringify(error)).not.toContain('privateValue');
    }
  });
});
