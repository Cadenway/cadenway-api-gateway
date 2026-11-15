import { Writable } from 'node:stream';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import { CAMILLE } from './support/fake-identity.js';
import { FakeIdentityServer } from './support/fake-identity-server.js';
import { expectPublicResponse } from './support/public-contract.js';
import { redisImage } from './support/redis-image.js';
import {
  ALLOWED_ORIGIN,
  generateSigningKeys,
  testConfig,
  type SigningKeys,
} from './support/test-environment.js';

/**
 * Password of the account of the fake identity-service.
 */
const PASSWORD = 'atelier-nord-sprint-14';

/**
 * Reads the session token out of the `Set-Cookie` of a route that signs in.
 *
 * @param response - Response of the route.
 * @returns The token.
 */
function sessionTokenOf(response: request.Response): string {
  const header: unknown = response.headers['set-cookie'];
  const cookie: string | undefined = Array.isArray(header) ? String(header[0]) : undefined;
  const token: string | undefined = /^__Host-cw_session=([^;]+);/u.exec(cookie ?? '')?.[1];
  if (token === undefined) {
    throw new Error('The response sets no session cookie.');
  }
  return decodeURIComponent(token);
}

describe('session guard against identity-service over HTTP', () => {
  const logLines: string[] = [];
  let keys: SigningKeys;
  let redis: StartedRedisContainer;
  let identity: FakeIdentityServer;
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    keys = generateSigningKeys();
    [redis, identity] = await Promise.all([
      new RedisContainer(redisImage()).start(),
      FakeIdentityServer.start(keys.publicJwk, CAMILLE, PASSWORD),
    ]);
    const sink: Writable = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
        done();
      },
    });
    app = await createGatewayApplication(
      testConfig({ REDIS_URL: redis.getConnectionUrl(), IDENTITY_SERVICE_URL: identity.url }, keys),
      sink,
    );
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await Promise.all([identity.stop(), redis.stop()]);
  });

  /**
   * Signs in by password as the web application does.
   *
   * @returns The response.
   */
  async function signIn(): Promise<request.Response> {
    const response: request.Response = await request(server)
      .post('/v1/auth/sign-in')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ email: CAMILLE.email, password: PASSWORD, rememberMe: true });
    expectPublicResponse('post', '/v1/auth/sign-in', response);
    return response;
  }

  /**
   * Reads the current user with a session token.
   *
   * @param token - Value of the session cookie.
   * @returns The response.
   */
  async function me(token: string): Promise<request.Response> {
    const response: request.Response = await request(server)
      .get('/v1/me')
      .set('Cookie', `__Host-cw_session=${encodeURIComponent(token)}`);
    expectPublicResponse('get', '/v1/me', response);
    return response;
  }

  /**
   * Counts the introspections identity-service received.
   *
   * @returns The count.
   */
  function introspections(): number {
    return identity.actorsOf('POST', '/internal/v1/tokens/introspect').length;
  }

  it('introspects the cookie on every request, so a revoked session stops at the next one', async () => {
    const signedIn: request.Response = await signIn();
    expect(signedIn.status).toBe(200);
    const token: string = sessionTokenOf(signedIn);
    const before: number = introspections();

    const first: request.Response = await me(token);
    const second: request.Response = await me(token);
    identity.revokeAll();
    const afterRevocation: request.Response = await me(token);

    expect(first.status).toBe(200);
    expect(first.body).toEqual(CAMILLE);
    expect(first.headers.etag).toBe('"2"');
    expect(second.status).toBe(200);
    expect(afterRevocation.status).toBe(401);
    expect(afterRevocation.body).toMatchObject({
      code: 'auth.session-expired',
      title: 'Session expirée',
    });
    expect(introspections() - before).toBe(3);
  });

  it('signs out: the session is revoked as its user, the cookie cleared, the next request refused', async () => {
    const token: string = sessionTokenOf(await signIn());
    await me(token).then((response) => {
      expect(response.status).toBe(200);
    });

    const signedOut: request.Response = await request(server)
      .post('/v1/auth/sign-out')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .set('Cookie', `__Host-cw_session=${encodeURIComponent(token)}`)
      .send({});
    const afterSignOut: request.Response = await me(token);

    expectPublicResponse('post', '/v1/auth/sign-out', signedOut);
    expect(signedOut.status).toBe(204);
    expect(signedOut.headers['set-cookie']).toEqual([
      '__Host-cw_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);
    expect(identity.actorsOf('DELETE', '/internal/v1/sessions/')).toEqual(['user']);
    expect(afterSignOut.status).toBe(401);
    expect(afterSignOut.body).toMatchObject({ code: 'auth.session-expired' });
  });

  it('retries an introspection that met a 503 once, then answers', async () => {
    const token: string = sessionTokenOf(await signIn());
    const before: number = introspections();
    identity.failingIntrospections = 1;

    const response: request.Response = await me(token);

    expect(response.status).toBe(200);
    expect(introspections() - before).toBe(2);
  });

  it('answers a wrong password with the French title and the attempts left', async () => {
    const response: request.Response = await request(server)
      .post('/v1/auth/sign-in')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ email: CAMILLE.email, password: 'not-the-password' });

    expectPublicResponse('post', '/v1/auth/sign-in', response);
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'E-mail ou mot de passe incorrect.',
      status: 422,
      code: 'auth.invalid-credentials',
      details: { remainingAttempts: 4 },
    });
  });

  it('signs every call with an internal token for identity-service, with the actor its route accepts', () => {
    expect(identity.calls.length).toBeGreaterThan(0);
    for (const call of identity.calls) {
      expect(call.principal).toMatchObject({ issuer: 'api-gateway', audience: 'identity-service' });
      expect(call.principal.organizationId).toBeNull();
    }
    expect(new Set(identity.actorsOf('POST', '/internal/v1/auth/sign-in'))).toEqual(
      new Set(['anonymous']),
    );
    expect(new Set(identity.actorsOf('POST', '/internal/v1/tokens/introspect'))).toEqual(
      new Set(['system']),
    );
    expect(new Set(identity.actorsOf('GET', '/internal/v1/users/'))).toEqual(new Set(['user']));
    const reads = identity.calls.filter((call) => call.path.startsWith('/internal/v1/users/'));
    expect(reads.every((call) => call.principal.actor.id === CAMILLE.id)).toBe(true);
  });

  it('writes neither a session token nor a password into the logs', () => {
    const logs: string = logLines.join('\n');

    expect(logs).not.toContain(PASSWORD);
    expect(logs).not.toMatch(/__Host-cw_session=[^;\s"]/u);
    const completions = logLines
      .map((line: string) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.route === '/v1/me' && line.status === 200);
    expect(completions.length).toBeGreaterThan(0);
    expect(completions.every((line) => line.userId === CAMILLE.id)).toBe(true);
  });
});
