import { ProblemException, runWithOrganizationContext } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../../../../../tests/support/fake-identity.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';
import { createSubscriptionAdapter } from './subscription.adapter.js';

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
  const getSubscription = vi.fn().mockResolvedValue({
    plan: 'free',
    seats: { used: 1, limit: 5 },
    guestCount: 0,
    storage: { attachmentBytesUsed: 0, limitBytes: 2_000_000_000 },
  });
  return {
    getOrganization,
    getSubscription,
    adapter: createSubscriptionAdapter({ getOrganization }, { getSubscription }),
  };
}

describe('subscription authority adapter', () => {
  it('checks the current Organization role before calling Billing', async () => {
    const { adapter, getOrganization, getSubscription } = fixture();
    await runWithOrganizationContext(context, () => adapter.read());
    expect(getOrganization).toHaveBeenCalledOnce();
    expect(getSubscription).toHaveBeenCalledOnce();
    expect(getOrganization.mock.invocationCallOrder[0]).toBeLessThan(
      getSubscription.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('refuses a current member even when the session previously held the owner role', async () => {
    const { adapter, getSubscription } = fixture('member');
    await expect(runWithOrganizationContext(context, () => adapter.read())).rejects.toMatchObject({
      problem: { status: 403, code: 'organization.role-forbidden' },
    });
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it('refuses a mismatched organization before calling Billing', async () => {
    const { adapter, getSubscription } = fixture('owner', '01938f6e-0000-7000-8000-000000000002');
    await expect(runWithOrganizationContext(context, () => adapter.read())).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it('does not disclose details from an unavailable Organization service', async () => {
    const { adapter, getOrganization, getSubscription } = fixture();
    getOrganization.mockRejectedValue(
      new ProblemException({ status: 503, code: 'upstream.timeout', detail: 'private detail' }),
    );
    try {
      await runWithOrganizationContext(context, () => adapter.read());
      expect.fail('expected Organization to reject');
    } catch (error) {
      expect(error).toMatchObject({ problem: { status: 503, code: 'upstream.timeout' } });
      expect(JSON.stringify(error)).not.toContain('private detail');
    }
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it('removes upstream detail from a Billing availability problem', async () => {
    const { adapter, getSubscription } = fixture();
    getSubscription.mockRejectedValue(
      new ProblemException({
        status: 503,
        code: 'billing.unavailable',
        detail: 'private dependency detail',
      }),
    );
    try {
      await runWithOrganizationContext(context, () => adapter.read());
      expect.fail('expected Billing to reject');
    } catch (error) {
      expect(error).toMatchObject({ problem: { status: 503, code: 'billing.unavailable' } });
      expect(JSON.stringify(error)).not.toContain('private dependency detail');
    }
  });
});
