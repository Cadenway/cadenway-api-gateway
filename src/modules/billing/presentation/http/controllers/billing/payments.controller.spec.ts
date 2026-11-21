import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { StartCheckout } from '../../../../application/use-cases/commands/billing/start-checkout/start-checkout.use-case.js';
import { ListInvoices } from '../../../../application/use-cases/queries/billing/list-invoices/list-invoices.use-case.js';
import { PaymentsController } from './payments.controller.js';

describe('payments controller', () => {
  it('projects checkout and invoice responses and retains private cache policy', async () => {
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ url: 'https://checkout.example.test/session', private: true });
    const listInvoices = vi.fn().mockResolvedValue({ items: [], nextCursor: null, private: true });
    const payments = { startCheckout, listInvoices };
    const controller = new PaymentsController(
      new StartCheckout(payments),
      new ListInvoices(payments),
    );
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;
    const request = {
      headersDistinct: { 'idempotency-key': ['request-key'] },
    } as unknown as Request;
    await expect(
      controller.startCheckout({}, { plan: 'team' }, request, response),
    ).resolves.toEqual({
      url: 'https://checkout.example.test/session',
    });
    await expect(controller.listInvoices({ limit: 50 }, response)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(startCheckout).toHaveBeenCalledWith({ plan: 'team' }, 'request-key');
    expect(setHeader).toHaveBeenCalledTimes(2);
  });

  it('rejects repeated idempotency keys before calling Billing', async () => {
    const startCheckout = vi.fn();
    const payments = { startCheckout, listInvoices: vi.fn() };
    const controller = new PaymentsController(
      new StartCheckout(payments),
      new ListInvoices(payments),
    );
    const request = {
      headersDistinct: { 'idempotency-key': ['one', 'two'] },
    } as unknown as Request;
    await expect(
      controller.startCheckout({}, { plan: 'team' }, request, {
        setHeader: vi.fn(),
      } as unknown as Response),
    ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
    expect(startCheckout).not.toHaveBeenCalled();
  });
});
