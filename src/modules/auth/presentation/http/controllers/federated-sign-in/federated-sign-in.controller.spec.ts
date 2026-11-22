import { Writable } from 'node:stream';

import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CAMILLE,
  CAMILLE_SESSION,
  createFakeIdentity,
  identityProblem,
} from '../../../../../../../tests/support/fake-identity.js';
import { expectPublicResponse } from '../../../../../../../tests/support/public-contract.js';
import { createFakeCounter } from '../../../../../../../tests/support/route-application.js';
import { ALLOWED_ORIGIN, testConfig } from '../../../../../../../tests/support/test-environment.js';
import { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import { createGatewayApplication } from '../../../../../../gateway-application.js';
import type { RequestCounter } from '../../../../../rate-limit/application/ports/outbound/counters/requests/request-counter.port.js';
import { ANONYMOUS_REQUEST_COUNTER } from '../../../../../rate-limit/composition/tokens/addresses/anonymous-request-counter.token.js';
import type { FederatedSignInAuthority } from '../../../../application/ports/outbound/identity/federated-sign-in/federated-sign-in-authority.port.js';
import { AuthModule } from '../../../../auth.module.js';

const PATH = '/v1/auth/sign-in/federated';
const OAUTH_PATH = `${PATH}/providers/google/callback`;
const OAUTH_CONTRACT_PATH = `${PATH}/providers/{provider}/callback`;
const SAML_PATH = `${PATH}/saml/callback`;
const CONTINUATION = `${ALLOWED_ORIGIN}/auth/federated/continue`;
const AUTHORIZATION_URL = 'https://identity-provider.example.test/authorize';
const STATE = 'example-state-proof'.repeat(2);
const CODE = 'example-oauth-code';
const BINDING = 'example-binding-proof'.repeat(2);
const RECEIPT = 'example-one-use-receipt'.repeat(2);
const SESSION = 'example-new-cadenway-session';
const TRUSTED_DEVICE = 'example-existing-device';
const FORM_ASSERTION = Buffer.from('<SyntheticAssertion/>').toString('base64');

@Module({ imports: [AuthModule] })
class FederatedRouteTestModule {}

describe('federated sign-in HTTP', () => {
  const identity = createFakeIdentity();
  const authority = {
    startFederatedSignIn: vi.fn<FederatedSignInAuthority['startFederatedSignIn']>(),
    completeOAuthSignIn: vi.fn<FederatedSignInAuthority['completeOAuthSignIn']>(),
    completeSamlSignIn: vi.fn<FederatedSignInAuthority['completeSamlSignIn']>(),
    finishFederatedSignIn: vi.fn<FederatedSignInAuthority['finishFederatedSignIn']>(),
  };
  const counter = createFakeCounter();
  const logLines: string[] = [];
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    const log = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logLines.push(chunk.toString('utf8'));
        done();
      },
    });
    const config = testConfig({ FEDERATED_CONTINUATION_URL: CONTINUATION });
    app = await createGatewayApplication(config, log, FederatedRouteTestModule);
    Object.assign(app.get(IdentityServiceClient), identity, authority);
    Object.assign(app.get<symbol, RequestCounter>(ANONYMOUS_REQUEST_COUNTER), counter);
    await app.init();
    server = app.getHttpServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    logLines.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { body: { provider: 'google' }, sameSite: 'Lax' },
    { body: { provider: 'saml', email: CAMILLE.email, rememberMe: true }, sameSite: 'None' },
  ])(
    'starts $body.provider with the browser binding confined to its cookie',
    async ({ body, sameSite }) => {
      authority.startFederatedSignIn.mockResolvedValueOnce({
        authorizationUrl: AUTHORIZATION_URL,
        browserBinding: BINDING,
        expiresAt: new Date(Date.now() + 1_200_000).toISOString(),
      });
      const response = await request(server)
        .post(`${PATH}/start`)
        .set('Origin', ALLOWED_ORIGIN)
        .send(body);

      expect(response.status).toBe(200);
      expectPublicResponse('post', `${PATH}/start`, response);
      expect(response.body).toEqual({ authorizationUrl: AUTHORIZATION_URL });
      expect(response.headers['set-cookie']).toEqual([
        `__Host-cw_federated_flow=${BINDING}; Path=/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=600`,
        '__Host-cw_federated_receipt=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
      ]);
      expect(authority.startFederatedSignIn).toHaveBeenCalledExactlyOnceWith({
        rememberMe: false,
        ...body,
      });
    },
  );

  it('requires an explicitly allowed Origin and JSON before opening a flow', async () => {
    const response = await request(server)
      .post(`${PATH}/start`)
      .set('Origin', 'https://elsewhere.example.test')
      .send({ provider: 'google' });

    expect(response.status).toBe(403);
    expectPublicResponse('post', `${PATH}/start`, response);
    expect(authority.startFederatedSignIn).not.toHaveBeenCalled();
  });

  it('refuses client-supplied redirects on start before calling Identity', async () => {
    const response = await request(server)
      .post(`${PATH}/start`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ provider: 'github', returnUrl: AUTHORIZATION_URL });

    expect(response.status).toBe(400);
    expectPublicResponse('post', `${PATH}/start`, response);
    expect(authority.startFederatedSignIn).not.toHaveBeenCalled();
  });

  it('redirects to the fixed Webapp URL with only the receipt cookie after OAuth', async () => {
    authority.completeOAuthSignIn.mockResolvedValueOnce({
      receipt: RECEIPT,
      expiresAt: new Date(Date.now() + 240_000).toISOString(),
    });
    const response = await request(server)
      .get(OAUTH_PATH)
      .query({ state: STATE, code: CODE, authuser: '0', session_state: 'provider-field' })
      .set('Cookie', `__Host-cw_federated_flow=${BINDING}; __Host-cw_session=stale-session`)
      .set('Authorization', 'Bearer stale-token');

    expect(response.status).toBe(303);
    expectPublicResponse('get', OAUTH_CONTRACT_PATH, response);
    expect(response.headers.location).toBe(CONTINUATION);
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['set-cookie']).toEqual([
      `__Host-cw_federated_receipt=${RECEIPT}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=120`,
      '__Host-cw_federated_flow=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);
    expect(authority.completeOAuthSignIn).toHaveBeenCalledExactlyOnceWith({
      provider: 'google',
      state: STATE,
      browserBinding: BINDING,
      response: { outcome: 'authorized', code: CODE },
    });
    expect(identity.introspect).not.toHaveBeenCalled();
    expect(identity.introspectApiToken).not.toHaveBeenCalled();
    for (const value of [CODE, STATE, BINDING, RECEIPT]) {
      expect(logLines.join()).not.toContain(value);
    }
  });

  it.each([
    `state=${STATE}&st%61te=${STATE}&code=${CODE}`,
    `state=${STATE}&code=${CODE}&error=access_denied`,
    `state=${STATE}&unexpected=${CODE}`,
    `state=${STATE}&code=%FF`,
    `state=${STATE}`,
  ])('refuses invalid OAuth callback shapes before Identity', async (query) => {
    const response = await request(server)
      .get(`${OAUTH_PATH}?${query}`)
      .set('Cookie', `__Host-cw_federated_flow=${BINDING}`);

    expect(response.status).toBe(400);
    expectPublicResponse('get', OAUTH_CONTRACT_PATH, response);
    expect(response.text).not.toContain(CODE);
    expect(response.text).not.toContain(STATE);
    expect(authority.completeOAuthSignIn).not.toHaveBeenCalled();
  });

  it('passes a provider denial to Identity and responds with an opaque refusal', async () => {
    authority.completeOAuthSignIn.mockRejectedValueOnce(
      identityProblem(422, 'auth.federated-sign-in-refused', { providerReason: CODE }),
    );
    const response = await request(server)
      .get(OAUTH_PATH)
      .query({ state: STATE, error: 'access_denied', error_description: CODE })
      .set('Cookie', `__Host-cw_federated_flow=${BINDING}`);

    expect(response.status).toBe(422);
    expectPublicResponse('get', OAUTH_CONTRACT_PATH, response);
    expect(response.body).toMatchObject({ code: 'auth.federated-sign-in-refused' });
    expect(response.text).not.toContain(CODE);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(authority.completeOAuthSignIn).toHaveBeenCalledExactlyOnceWith({
      provider: 'google',
      state: STATE,
      browserBinding: BINDING,
      response: { outcome: 'denied', error: 'access_denied' },
    });
  });

  it('refuses an OAuth callback without the dedicated browser binding', async () => {
    const response = await request(server).get(OAUTH_PATH).query({ state: STATE, code: CODE });

    expect(response.status).toBe(422);
    expectPublicResponse('get', OAUTH_CONTRACT_PATH, response);
    expect(authority.completeOAuthSignIn).not.toHaveBeenCalled();
  });

  it('accepts the cross-site SAML form and expires its flow cookie after verification', async () => {
    authority.completeSamlSignIn.mockResolvedValueOnce({
      receipt: RECEIPT,
      expiresAt: new Date(Date.now() + 240_000).toISOString(),
    });
    const response = await request(server)
      .post(SAML_PATH)
      .set('Origin', 'https://identity-provider.example.test')
      .set('Cookie', `__Host-cw_federated_flow=${BINDING}`)
      .type('form')
      .send({ SAMLResponse: FORM_ASSERTION, RelayState: STATE });

    expect(response.status).toBe(303);
    expectPublicResponse('post', SAML_PATH, response);
    expect(response.headers.location).toBe(CONTINUATION);
    expect(response.headers['set-cookie']).toEqual([
      `__Host-cw_federated_receipt=${RECEIPT}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=120`,
      '__Host-cw_federated_flow=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0',
    ]);
    expect(authority.completeSamlSignIn).toHaveBeenCalledExactlyOnceWith({
      samlResponse: FORM_ASSERTION,
      relayState: STATE,
      browserBinding: BINDING,
    });
    expect(logLines.join()).not.toContain(FORM_ASSERTION);
  });

  it.each([
    `SAMLResponse=${encodeURIComponent(FORM_ASSERTION)}&RelayState=${STATE}&RelayState=${STATE}`,
    `SAMLResponse=${encodeURIComponent(FORM_ASSERTION)}&RelayState=${STATE}&__proto__=x`,
    `SAMLResponse=%%%INVALID&RelayState=${STATE}`,
    `SAMLResponse=invalid-base64&RelayState=${STATE}`,
  ])('refuses malformed SAML forms before Identity', async (form) => {
    const response = await request(server)
      .post(SAML_PATH)
      .set('Cookie', `__Host-cw_federated_flow=${BINDING}`)
      .type('form')
      .send(form);

    expect(response.status).toBe(400);
    expectPublicResponse('post', SAML_PATH, response);
    expect(response.text).not.toContain(STATE);
    expect(authority.completeSamlSignIn).not.toHaveBeenCalled();
  });

  it('enforces the anonymous callback rate limit before Identity', async () => {
    counter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 9 });
    const response = await request(server)
      .get(OAUTH_PATH)
      .query({ state: STATE, code: CODE })
      .set('Cookie', `__Host-cw_federated_flow=${BINDING}`);

    expect(response.status).toBe(429);
    expectPublicResponse('get', OAUTH_CONTRACT_PATH, response);
    expect(response.headers['retry-after']).toBe('9');
    expect(authority.completeOAuthSignIn).not.toHaveBeenCalled();
  });

  it('rejects an oversized SAML form with the callback privacy headers before forwarding', async () => {
    const response = await request(server)
      .post(SAML_PATH)
      .type('form')
      .send(`SAMLResponse=${'%2F'.repeat(270_000)}&RelayState=${STATE}`);

    expect(response.status).toBe(400);
    expectPublicResponse('post', SAML_PATH, response);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(authority.completeSamlSignIn).not.toHaveBeenCalled();
  });

  it('finishes with the standard session cookie and forwards the existing trusted device', async () => {
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    authority.finishFederatedSignIn.mockResolvedValueOnce({
      outcome: 'signed-in',
      session: {
        token: SESSION,
        session: { id: CAMILLE_SESSION.sessionId, expiresAt, persistent: false },
        user: CAMILLE,
        deletionCancelled: true,
      },
    });
    const response = await request(server)
      .post(`${PATH}/finish`)
      .set('Origin', ALLOWED_ORIGIN)
      .set(
        'Cookie',
        `__Host-cw_federated_receipt=${RECEIPT}; __Host-cw_trusted_device=${TRUSTED_DEVICE}`,
      )
      .set('User-Agent', 'Example Browser')
      .send({});

    expect(response.status).toBe(200);
    expectPublicResponse('post', `${PATH}/finish`, response);
    expect(response.body).toEqual({
      user: CAMILLE,
      session: { id: CAMILLE_SESSION.sessionId, expiresAt },
      deletionCancelled: true,
    });
    expect(response.headers['set-cookie']).toEqual([
      '__Host-cw_federated_receipt=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
      `__Host-cw_session=${SESSION}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    ]);
    expect(authority.finishFederatedSignIn).toHaveBeenCalledExactlyOnceWith({
      receipt: RECEIPT,
      trustedDeviceToken: TRUSTED_DEVICE,
      client: { ipAddress: '127.0.0.1', userAgent: 'Example Browser' },
    });
    for (const value of [RECEIPT, TRUSTED_DEVICE, SESSION]) {
      expect(logLines.join()).not.toContain(value);
    }
  });

  it('clears the receipt and returns the expected 202 challenge without a session', async () => {
    const challenge = {
      token: 'synthetic-two-step-challenge'.repeat(2),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      name: CAMILLE.name,
      email: CAMILLE.email,
      primaryMethod: 'authenticator-app',
      methods: ['authenticator-app', 'backup-code'],
      securityKeys: [],
      backupCodesRemaining: 3,
      lockedUntil: null,
    };
    authority.finishFederatedSignIn.mockResolvedValueOnce({ outcome: 'challenge', challenge });
    const response = await request(server)
      .post(`${PATH}/finish`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', `__Host-cw_federated_receipt=${RECEIPT}`)
      .send({});

    expect(response.status).toBe(202);
    expectPublicResponse('post', `${PATH}/finish`, response);
    expect(response.body).toEqual(challenge);
    expect(response.headers['set-cookie']).toEqual([
      '__Host-cw_federated_receipt=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);
  });

  it('requires empty JSON and ignores a receipt supplied in the body', async () => {
    const response = await request(server)
      .post(`${PATH}/finish`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ receipt: RECEIPT });

    expect(response.status).toBe(400);
    expectPublicResponse('post', `${PATH}/finish`, response);
    expect(response.text).not.toContain(RECEIPT);
    expect(authority.finishFederatedSignIn).not.toHaveBeenCalled();
  });

  it('keeps the receipt when another origin tries to finish the sign-in', async () => {
    const response = await request(server)
      .post(`${PATH}/finish`)
      .set('Origin', 'https://elsewhere.example.test')
      .set('Cookie', `__Host-cw_federated_receipt=${RECEIPT}`)
      .send({});

    expect(response.status).toBe(403);
    expectPublicResponse('post', `${PATH}/finish`, response);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(authority.finishFederatedSignIn).not.toHaveBeenCalled();
  });

  it('clears the receipt and returns a public 503 when the sign-in authority is unavailable', async () => {
    authority.finishFederatedSignIn.mockRejectedValueOnce(
      identityProblem(503, 'auth.federated-unavailable', { receipt: RECEIPT }),
    );
    const response = await request(server)
      .post(`${PATH}/finish`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', `__Host-cw_federated_receipt=${RECEIPT}`)
      .send({});

    expect(response.status).toBe(503);
    expectPublicResponse('post', `${PATH}/finish`, response);
    expect(response.body).toMatchObject({
      code: 'upstream.unavailable',
      details: { service: 'identity-service' },
    });
    expect(response.headers['set-cookie']).toEqual([
      '__Host-cw_federated_receipt=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);
    expect(response.text).not.toContain(RECEIPT);
  });
});
