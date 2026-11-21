import {
  InternalHttpClient,
  InternalTokenSigner,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, OrganizationContext } from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { BILLING_SERVICE, BillingServiceClient } from './billing-service.client.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: [],
};
const subscription = {
  plan: 'free',
  seats: { used: 3, limit: 5 },
  guestCount: 1,
  storage: { attachmentBytesUsed: 120_000_000, limitBytes: 2_000_000_000 },
};
const headers = { 'Cache-Control': 'private, no-store' };

describe('BillingServiceClient', () => {
  let signer: InternalTokenSigner;
  let answer: Response;
  let calls: { url: string; init?: RequestInit }[];
  let client: BillingServiceClient;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
  });

  beforeEach(() => {
    calls = [];
    answer = Response.json(subscription, { headers });
    client = new BillingServiceClient(
      new InternalHttpClient({
        service: BILLING_SERVICE,
        baseUrl: 'http://billing-service.test',
        signer,
        allowedUnavailableProblemCodes: ['billing.unavailable'],
        fetch: (input, init) => {
          calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
          return Promise.resolve(answer.clone());
        },
      }),
    );
  });

  it('forwards the current user and organization with a signed subscription read', async () => {
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).resolves.toEqual(subscription);
    expect(calls[0]?.url).toBe('http://billing-service.test/internal/v1/billing/subscription');
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toMatch(/^Bearer /u);
  });

  it('rejects malformed bodies and a missing private cache policy', async () => {
    answer = Response.json({ ...subscription, seats: { used: -1, limit: 5 } }, { headers });
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });

    answer = Response.json(subscription);
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('bounds decoded response bytes', async () => {
    answer = new Response('x'.repeat(16 * 1024 + 1), {
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    });
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('preserves the documented unavailable billing baseline', async () => {
    answer = Response.json(
      { type: 'about:blank', title: 'Unavailable', status: 503, code: 'billing.unavailable' },
      { status: 503, headers: { ...headers, 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.getSubscription()),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'billing.unavailable' },
    });
  });
});
