import { ProblemException, runWithOrganizationContext } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../../../../../tests/support/fake-identity.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';
import { createPaymentsAdapter } from './payments.adapter.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: [],
};

function fixture(role: 'owner' | 'member' = 'owner', id = ATELIER_NORD_ID) {
  const getOrganization = vi.fn<OrganizationServiceClient['getOrganization']>().mockResolvedValue({
    id,
    name: 'Atelier Nord',
    slug: 'atelier-nord',
    description: null,
    website: null,
    defaultLanguage: 'fr',
    plan: 'free',
    memberCount: 1,
    role,
    createdAt: '2026-01-01T00:00:00Z',
    version: 1,
  });
  const startCheckout = vi.fn().mockResolvedValue({ url: 'https://checkout.example.test/session' });
  const listInvoices = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
  return {
    getOrganization,
    startCheckout,
    listInvoices,
    adapter: createPaymentsAdapter({ getOrganization }, { startCheckout, listInvoices }),
  };
}

describe('payment authority adapter', () => {
  it('rechecks current ownership for every checkout replay and invoice page', async () => {
    const f = fixture();
    await runWithOrganizationContext(context, async () => {
      await f.adapter.startCheckout({ plan: 'team' }, 'request-key');
      await f.adapter.startCheckout({ plan: 'team' }, 'request-key');
      await f.adapter.listInvoices({ limit: 50, cursor: 'next' });
    });
    expect(f.getOrganization).toHaveBeenCalledTimes(3);
    expect(f.startCheckout).toHaveBeenCalledTimes(2);
    expect(f.startCheckout).toHaveBeenCalledWith({ plan: 'team' }, 'request-key');
    expect(f.listInvoices).toHaveBeenCalledWith({ limit: 50, cursor: 'next' });
  });

  it.each(['member', 'wrong-tenant'] as const)(
    'refuses %s before reaching Billing',
    async (kind) => {
      const f =
        kind === 'member'
          ? fixture('member')
          : fixture('owner', '01938f6e-0000-7000-8000-000000000002');
      await expect(
        runWithOrganizationContext(context, () => f.adapter.startCheckout({ plan: 'team' }, 'key')),
      ).rejects.toMatchObject({ problem: { status: kind === 'member' ? 403 : 503 } });
      expect(f.startCheckout).not.toHaveBeenCalled();
    },
  );

  it('translates Billing conflicts without disclosing upstream details', async () => {
    const f = fixture();
    f.startCheckout.mockRejectedValue(
      new ProblemException({
        status: 409,
        code: 'billing.checkout-in-progress',
        detail: 'provider-private',
      }),
    );
    await expect(
      runWithOrganizationContext(context, () => f.adapter.startCheckout({ plan: 'team' }, 'key')),
    ).rejects.toMatchObject({ problem: { status: 409, code: 'billing.checkout-in-progress' } });
    try {
      await runWithOrganizationContext(context, () =>
        f.adapter.startCheckout({ plan: 'team' }, 'key'),
      );
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('provider-private');
    }
  });
});
