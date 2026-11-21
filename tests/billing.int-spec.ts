import { Writable } from 'node:stream';

import { InternalTokenVerifier } from '@cadenway/nest-common';
import type { InternalPrincipal } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import type { RequestCounter } from '../src/modules/rate-limit/application/ports/outbound/counters/requests/request-counter.port.js';
import { ANONYMOUS_REQUEST_COUNTER } from '../src/modules/rate-limit/composition/tokens/addresses/anonymous-request-counter.token.js';
import { BEARER_FAILURE_COUNTER } from '../src/modules/rate-limit/composition/tokens/addresses/bearer-failure-counter.token.js';
import { REQUEST_COUNTER } from '../src/modules/rate-limit/composition/tokens/requests/request-counter.token.js';
import { ATELIER_NORD_ID, CAMILLE } from './support/fake-identity.js';
import { ATELIER_NORD } from './support/fake-organization.js';
import { expectPublicResponse } from './support/public-contract.js';
import { createFakeCounter } from './support/route-application.js';
import { GATEWAY_ISSUER, generateSigningKeys, testConfig } from './support/test-environment.js';

const IDENTITY_URL = 'http://identity-service.test';
const ORGANIZATION_URL = 'http://organization-service.test';
const BILLING_URL = 'http://billing-service.test';
const PATH = '/v1/billing/subscription';
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
  const calls: { service: string; principal: InternalPrincipal }[] = [];
  let app: NestExpressApplication;
  let server: App;
  let organizationAnswer: () => Response | Promise<Response>;
  let billingAnswer: () => Response | Promise<Response>;

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
    for (const token of [ANONYMOUS_REQUEST_COUNTER, BEARER_FAILURE_COUNTER]) {
      Object.assign(app.get<symbol, RequestCounter>(token), createFakeCounter());
    }
    await app.init();
    server = app.getHttpServer();
  });

  beforeEach(() => {
    calls.length = 0;
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
});
