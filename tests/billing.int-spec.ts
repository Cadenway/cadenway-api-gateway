import { Writable } from 'node:stream';

import { InternalTokenVerifier } from '@cadenway/nest-common';
import type { InternalPrincipal } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import type { RequestCounter } from '../src/modules/rate-limit/application/ports/outbound/counters/requests/request-counter.port.js';
import { CountWebhookRequest } from '../src/modules/rate-limit/application/use-cases/commands/addresses/count-webhook-request/count-webhook-request.use-case.js';
import { ANONYMOUS_REQUEST_COUNTER } from '../src/modules/rate-limit/composition/tokens/addresses/anonymous-request-counter.token.js';
import { BEARER_FAILURE_COUNTER } from '../src/modules/rate-limit/composition/tokens/addresses/bearer-failure-counter.token.js';
import { REQUEST_COUNTER } from '../src/modules/rate-limit/composition/tokens/requests/request-counter.token.js';
import { ATELIER_NORD_ID, CAMILLE } from './support/fake-identity.js';
import { ATELIER_NORD } from './support/fake-organization.js';
import { expectPublicResponse } from './support/public-contract.js';
import { createFakeCounter } from './support/route-application.js';
import {
  ALLOWED_ORIGIN,
  GATEWAY_ISSUER,
  generateSigningKeys,
  testConfig,
} from './support/test-environment.js';

const IDENTITY_URL = 'http://identity-service.test';
const ORGANIZATION_URL = 'http://organization-service.test';
const BILLING_URL = 'http://billing-service.test';
const PATH = '/v1/billing/subscription';
const CHECKOUT_PATH = '/v1/billing/checkout';
const INVOICES_PATH = '/v1/billing/invoices';
const STRIPE_PATH = '/v1/billing/webhooks/stripe';
const STRIPE_SIGNATURE = 't=1795279200,v1=fixture-signature';
const SESSION = 'billing-session';
const WITHOUT_ORGANIZATION = 'billing-session-without-organization';
const OTHER_ORGANIZATION = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const subscription = {
  plan: 'free',
  seats: { used: 3, limit: 5 },
  guestCount: 1,
  storage: { attachmentBytesUsed: 120_000_000, limitBytes: 2_000_000_000 },
};

describe('Billing subscription through the public gateway', () => {
  const network = setupServer();
  const credentialCounter = createFakeCounter();
  const webhookAllowance = vi.fn<CountWebhookRequest['execute']>();
  const calls: { service: string; principal: InternalPrincipal }[] = [];
  const webhookCalls: { body: Buffer; signature: string | null; principal: InternalPrincipal }[] =
    [];
  const paymentCalls: {
    service: string;
    principal: InternalPrincipal;
    key: string | null;
    body: unknown;
  }[] = [];
  let app: NestExpressApplication;
  let server: App;
  let organizationAnswer: () => Response | Promise<Response>;
  let billingAnswer: () => Response | Promise<Response>;
  let webhookAnswer: () => Response;

  async function send(session: string | null = SESSION, path = PATH): Promise<request.Response> {
    let call = request(server).get(path);
    if (session !== null) call = call.set('Cookie', `__Host-cw_session=${session}`);
    const response = await call;
    expectPublicResponse('get', PATH, response);
    return response;
  }

  beforeAll(async () => {
    const keys = generateSigningKeys();
    const verifier = async (audience: string, token: string): Promise<InternalPrincipal> => {
      const checker = await InternalTokenVerifier.create({
        audience,
        trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
      });
      return checker.verify(token.replace(/^Bearer /u, ''));
    };
    network.listen({ onUnhandledFrame: 'bypass' });
    network.use(
      http.post(`${IDENTITY_URL}/internal/v1/tokens/introspect`, async ({ request: call }) => {
        const input = (await call.json()) as { readonly token?: string };
        return HttpResponse.json({
          active: true,
          tokenType: 'session',
          sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a61',
          userId: CAMILLE.id,
          organizationId: input.token === WITHOUT_ORGANIZATION ? null : ATELIER_NORD_ID,
          role: input.token === WITHOUT_ORGANIZATION ? null : 'owner',
          scopes: ['tasks:read', 'tasks:write'],
          expiresAt: '2026-12-08T13:07:00Z',
        });
      }),
      http.get(`${ORGANIZATION_URL}/internal/v1/organization`, async ({ request: call }) => {
        calls.push({
          service: 'organization',
          principal: await verifier(
            'organization-service',
            call.headers.get('Authorization') ?? '',
          ),
        });
        return organizationAnswer();
      }),
      http.get(`${BILLING_URL}/internal/v1/billing/subscription`, async ({ request: call }) => {
        calls.push({
          service: 'billing',
          principal: await verifier('billing-service', call.headers.get('Authorization') ?? ''),
        });
        return billingAnswer();
      }),
      http.post(`${BILLING_URL}/internal/v1/billing/checkout`, async ({ request: call }) => {
        paymentCalls.push({
          service: 'checkout',
          principal: await verifier('billing-service', call.headers.get('Authorization') ?? ''),
          key: call.headers.get('Idempotency-Key'),
          body: await call.json(),
        });
        return HttpResponse.json(
          { url: 'https://checkout.example.test/session' },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      }),
      http.get(`${BILLING_URL}/internal/v1/billing/invoices`, async ({ request: call }) => {
        paymentCalls.push({
          service: 'invoices',
          principal: await verifier('billing-service', call.headers.get('Authorization') ?? ''),
          key: null,
          body: null,
        });
        return HttpResponse.json(
          { items: [], nextCursor: null },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      }),
      http.post(`${BILLING_URL}/internal/v1/billing/webhooks/stripe`, async ({ request: call }) => {
        webhookCalls.push({
          body: Buffer.from(await call.arrayBuffer()),
          signature: call.headers.get('Stripe-Signature'),
          principal: await verifier('billing-service', call.headers.get('Authorization') ?? ''),
        });
        return webhookAnswer();
      }),
    );
    const sink = new Writable({
      write(_chunk, _encoding, done): void {
        done();
      },
    });
    app = await createGatewayApplication(
      testConfig(
        {
          IDENTITY_SERVICE_URL: IDENTITY_URL,
          ORGANIZATION_SERVICE_URL: ORGANIZATION_URL,
          BILLING_SERVICE_URL: BILLING_URL,
        },
        keys,
      ),
      sink,
    );
    Object.assign(app.get<symbol, RequestCounter>(REQUEST_COUNTER), credentialCounter);
    Object.assign(app.get(CountWebhookRequest), { execute: webhookAllowance });
    for (const token of [ANONYMOUS_REQUEST_COUNTER, BEARER_FAILURE_COUNTER]) {
      Object.assign(app.get<symbol, RequestCounter>(token), createFakeCounter());
    }
    await app.init();
    server = app.getHttpServer();
  });

  beforeEach(() => {
    calls.length = 0;
    paymentCalls.length = 0;
    webhookCalls.length = 0;
    webhookAllowance.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    webhookAnswer = () =>
      new HttpResponse(null, {
        status: 204,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    credentialCounter.consume.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    organizationAnswer = () => HttpResponse.json(ATELIER_NORD);
    billingAnswer = () =>
      HttpResponse.json(subscription, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
  });

  afterAll(async () => {
    await app.close();
    network.close();
  });

  it('relays the exact Stripe JSON bytes and signature without a browser session', async () => {
    const body = '{\n  "provider-fixture": "événement"\n}\n';
    const response = await request(server)
      .post(STRIPE_PATH)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', STRIPE_SIGNATURE)
      .send(body);
    expectPublicResponse('post', STRIPE_PATH, response);
    expect(response.status).toBe(204);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(webhookCalls).toHaveLength(1);
    expect(webhookCalls[0]).toMatchObject({
      body: Buffer.from(body),
      signature: STRIPE_SIGNATURE,
      principal: { actor: { type: 'system', id: GATEWAY_ISSUER }, organizationId: null },
    });
    expect(calls).toHaveLength(0);
  });

  it('returns the public Stripe quota error before forwarding', async () => {
    webhookAllowance.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });
    const response = await request(server)
      .post(STRIPE_PATH)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', STRIPE_SIGNATURE)
      .send('{}');
    expectPublicResponse('post', STRIPE_PATH, response);
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('9');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(webhookAllowance).toHaveBeenCalledWith(expect.any(String), 'stripe');
    expect(webhookCalls).toHaveLength(0);
  });

  it('discards the upstream details of an invalid Stripe signature', async () => {
    webhookAnswer = () =>
      HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Untrusted upstream title',
          status: 400,
          code: 'billing.invalid-webhook-signature',
          details: { providerId: 'fixture-provider-id' },
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      );
    const response = await request(server)
      .post(STRIPE_PATH)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', STRIPE_SIGNATURE)
      .send('{}');
    expectPublicResponse('post', STRIPE_PATH, response);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'billing.invalid-webhook-signature' });
    expect(response.body).not.toHaveProperty('details');
    expect(response.text).not.toContain('fixture-provider-id');
    expect(webhookCalls).toHaveLength(1);
  });

  it.each([
    ['gzip', '{}', 'billing.invalid-webhook'],
    ['identity', 'x'.repeat(1_048_577), 'request.body-too-large'],
  ])('rejects %s Stripe parser errors before forwarding', async (encoding, body, code) => {
    const response = await request(server)
      .post(STRIPE_PATH)
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', encoding)
      .set('Stripe-Signature', STRIPE_SIGNATURE)
      .send(body);
    expectPublicResponse('post', STRIPE_PATH, response);
    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({ code });
    expect(webhookCalls).toHaveLength(0);
  });

  it('checks the current owner and signs both service calls with the selected tenant', async () => {
    const response = await request(server)
      .get(PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`)
      .set('If-None-Match', '*');
    expectPublicResponse('get', PATH, response);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(subscription);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls.map(({ service }) => service)).toEqual(['organization', 'billing']);
    for (const { principal } of calls) {
      expect(principal).toMatchObject({
        actor: { type: 'user', id: CAMILLE.id },
        organizationId: ATELIER_NORD_ID,
      });
    }
  });

  it('refuses a former owner before calling Billing', async () => {
    organizationAnswer = () => HttpResponse.json({ ...ATELIER_NORD, role: 'member' });
    const response = await send();
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'organization.role-forbidden' });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls.map(({ service }) => service)).toEqual(['organization']);
  });

  it('rejects a wrong-organization authority response without calling Billing', async () => {
    organizationAnswer = () => HttpResponse.json({ ...ATELIER_NORD, id: OTHER_ORGANIZATION });
    const response = await send();
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls.map(({ service }) => service)).toEqual(['organization']);
  });

  it('keeps missing session, unselected tenant and invalid input private', async () => {
    const missing = await send(null);
    const noOrganization = await send(WITHOUT_ORGANIZATION);
    const invalid = await send(SESSION, `${PATH}?tenant=untrusted`);
    const malformed = await request(server)
      .get(PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`)
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expectPublicResponse('get', PATH, malformed);
    expect([missing.status, noOrganization.status, invalid.status, malformed.status]).toEqual([
      401, 403, 400, 400,
    ]);
    for (const response of [missing, noOrganization, invalid, malformed]) {
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
    expect(calls).toHaveLength(0);
  });

  it('returns a private 503 for an unavailable Billing source', async () => {
    billingAnswer = () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Unavailable', status: 503, code: 'billing.unavailable' },
        { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
      );
    const response = await send();
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects an exhausted session rate limit before either service is called', async () => {
    credentialCounter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await send();
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('12');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls).toHaveLength(0);
  });

  it('returns a bounded private failure for a slow Organization authority', async () => {
    organizationAnswer = async () => {
      await delay(2_500);
      return HttpResponse.json(ATELIER_NORD);
    };
    const response = await send();
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(calls.map(({ service }) => service)).toEqual(['organization']);
  });
  it('checks ownership for each checkout replay and invoice request and forwards the signed tenant', async () => {
    const checkout = async () =>
      request(server)
        .post(CHECKOUT_PATH)
        .set('Cookie', `__Host-cw_session=${SESSION}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('Idempotency-Key', 'checkout-fixture-123')
        .send({ plan: 'team' });
    const first = await checkout();
    const replay = await checkout();
    const invoices = await request(server)
      .get(INVOICES_PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`);
    expectPublicResponse('post', CHECKOUT_PATH, first);
    expectPublicResponse('post', CHECKOUT_PATH, replay);
    expectPublicResponse('get', INVOICES_PATH, invoices);
    for (const response of [first, replay, invoices]) {
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
    expect(first.body).toEqual({ url: 'https://checkout.example.test/session' });
    expect(invoices.body).toEqual({ items: [], nextCursor: null });
    expect(calls.map(({ service }) => service)).toEqual([
      'organization',
      'organization',
      'organization',
    ]);
    expect(paymentCalls.map(({ service }) => service)).toEqual([
      'checkout',
      'checkout',
      'invoices',
    ]);
    expect(paymentCalls.slice(0, 2)).toMatchObject([
      { key: 'checkout-fixture-123', body: { plan: 'team' } },
      { key: 'checkout-fixture-123', body: { plan: 'team' } },
    ]);
    for (const { principal } of [...calls, ...paymentCalls]) {
      expect(principal).toMatchObject({
        actor: { type: 'user', id: CAMILLE.id },
        organizationId: ATELIER_NORD_ID,
      });
    }
  });

  it('rejects revoked owners and malformed checkout without reaching Billing and keeps errors private', async () => {
    organizationAnswer = () => HttpResponse.json({ ...ATELIER_NORD, role: 'member' });
    const checkout = await request(server)
      .post(CHECKOUT_PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Idempotency-Key', 'checkout-fixture-123')
      .send({ plan: 'team' });
    const invoices = await request(server)
      .get(INVOICES_PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`);
    const malformed = await request(server)
      .post(CHECKOUT_PATH)
      .set('Cookie', `__Host-cw_session=${SESSION}`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ plan: 'team' });
    expectPublicResponse('post', CHECKOUT_PATH, checkout);
    expectPublicResponse('get', INVOICES_PATH, invoices);
    expectPublicResponse('post', CHECKOUT_PATH, malformed);
    expect([checkout.status, invoices.status, malformed.status]).toEqual([403, 403, 400]);
    for (const response of [checkout, invoices, malformed])
      expect(response.headers['cache-control']).toBe('private, no-store');
    expect(paymentCalls).toHaveLength(0);
  });
});
