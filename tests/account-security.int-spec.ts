import { Writable } from 'node:stream';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import { CAMILLE } from './support/fake-identity.js';
import { FakeIdentityServer } from './support/fake-identity-server.js';
import { expectPublicResponse, type SpecMethod } from './support/public-contract.js';
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
const PASSWORD = 'atelier-nord-sprint-14-before';

/**
 * Password chosen by the change of password.
 */
const CHANGED_PASSWORD = 'atelier-nord-sprint-15-changed';

/**
 * Password chosen with the reset link.
 */
const RESET_PASSWORD = 'atelier-nord-sprint-16-reset';

/**
 * New address of the account.
 */
const NEW_EMAIL = 'camille@ateliernord.fr';

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

describe('the security of the account against identity-service over HTTP', () => {
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
   * Sends a request as the web application does, checked against the public contract.
   *
   * @param method - Method of the route.
   * @param path - Path of the route, as the spec writes it.
   * @param token - Value of the session cookie, if any.
   * @param body - JSON body, if any.
   * @param url - URL of the request, the path by default.
   * @returns The response.
   */
  async function send(
    method: SpecMethod,
    path: string,
    token?: string,
    body?: object,
    url: string = path,
  ): Promise<request.Response> {
    let pending: request.Test = request(server)[method](url).set('User-Agent', 'Firefox');
    if (method !== 'get') {
      pending = pending.set('Origin', ALLOWED_ORIGIN);
    }
    if (token !== undefined) {
      pending = pending.set('Cookie', `__Host-cw_session=${encodeURIComponent(token)}`);
    }
    const response: request.Response =
      body === undefined ? await pending : await pending.send(body);
    expectPublicResponse(method, path, response);
    return response;
  }

  /**
   * Signs in by password.
   *
   * @param email - Address of the account.
   * @param password - Its password.
   * @returns The session token.
   */
  async function signIn(email: string, password: string): Promise<string> {
    const response: request.Response = await send('post', '/v1/auth/sign-in', undefined, {
      email,
      password,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return sessionTokenOf(response);
  }

  it('lists the sessions, closes the others, and closes one by its id', async () => {
    const first: string = await signIn(CAMILLE.email, PASSWORD);
    const second: string = await signIn(CAMILLE.email, PASSWORD);

    const listed: request.Response = await send('get', '/v1/sessions', first);
    expect(listed.status).toBe(200);
    const { items } = listed.body as { items: { id: string; current: boolean }[] };
    expect(items.filter((item) => item.current)).toHaveLength(1);
    const otherId: string | undefined = items.find((item) => !item.current)?.id;

    const unknown: request.Response = await send(
      'delete',
      '/v1/sessions/{sessionId}',
      first,
      undefined,
      '/v1/sessions/019a6914-2f7a-7b3c-9d4e-000000000000',
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({
      code: 'session.not-found',
      title: 'Session introuvable.',
    });

    const revoked: request.Response = await send(
      'delete',
      '/v1/sessions/{sessionId}',
      first,
      undefined,
      `/v1/sessions/${String(otherId)}`,
    );
    expect(revoked.status).toBe(204);
    expect((await send('get', '/v1/me', second)).status).toBe(401);

    await signIn(CAMILLE.email, PASSWORD);
    const others: request.Response = await send('post', '/v1/sessions/revoke-others', first, {});
    expect(others.status).toBe(200);
    expect((others.body as { revokedCount: number }).revokedCount).toBeGreaterThanOrEqual(1);
    expect((await send('get', '/v1/me', first)).status).toBe(200);
    expect(
      identity.calls
        .filter(
          (call) => call.path.startsWith('/internal/v1/users/') && call.path.includes('/sessions?'),
        )
        .every((call) => call.principal.actor.type === 'user'),
    ).toBe(true);
  });

  it('requires a recent authentication to change the address, then confirms it with its code', async () => {
    const token: string = await signIn(CAMILLE.email, PASSWORD);
    identity.forgetRecentAuthentications();

    const refused: request.Response = await send('post', '/v1/me/email-change', token, {
      email: NEW_EMAIL,
    });
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({
      type: 'about:blank',
      title: 'Confirmez votre identité pour continuer.',
      status: 403,
      code: 'auth.reauthentication-required',
      details: { methods: ['password'] },
    });

    const wrong: request.Response = await send('post', '/v1/auth/reauthentication', token, {
      password: 'not-the-password',
    });
    expect(wrong.status).toBe(422);
    expect(wrong.body).toMatchObject({
      code: 'auth.password-incorrect',
      details: { remainingAttempts: 4 },
    });

    const confirmed: request.Response = await send('post', '/v1/auth/reauthentication', token, {
      password: PASSWORD,
    });
    expect(confirmed.status).toBe(200);

    const requested: request.Response = await send('post', '/v1/me/email-change', token, {
      email: NEW_EMAIL,
    });
    expect(requested.status).toBe(202);
    const changed: request.Response = await send(
      'post',
      '/v1/me/email-change/confirmation',
      token,
      { code: identity.emailChangeCode },
    );
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ email: NEW_EMAIL });
    expect(changed.headers.etag).toBe(`"${String(CAMILLE.version)}"`);
  });

  it('changes the password, answering when it was set', async () => {
    const token: string = await signIn(NEW_EMAIL, PASSWORD);

    const changed: request.Response = await send('put', '/v1/me/password', token, {
      currentPassword: PASSWORD,
      newPassword: CHANGED_PASSWORD,
    });

    expect(changed.status).toBe(200);
    const { passwordChangedAt } = changed.body as { passwordChangedAt?: string };
    expect(typeof passwordChangedAt).toBe('string');
    expect((await send('get', '/v1/me', token)).body).toMatchObject({ passwordChangedAt });
  });

  it('resets a forgotten password with the token of the link in the bodies, without signing in', async () => {
    const token: string = await signIn(NEW_EMAIL, CHANGED_PASSWORD);

    const asked: request.Response = await send('post', '/v1/auth/password-reset', undefined, {
      email: NEW_EMAIL,
    });
    expect(asked.status).toBe(202);
    const resetToken = String(identity.resetToken);

    const inspected: request.Response = await send(
      'post',
      '/v1/auth/password-reset/inspection',
      undefined,
      { token: resetToken },
    );
    expect(inspected.status).toBe(200);
    expect(inspected.body).toMatchObject({ email: NEW_EMAIL });

    const reset: request.Response = await send(
      'post',
      '/v1/auth/password-reset/confirmation',
      undefined,
      { token: resetToken, newPassword: RESET_PASSWORD },
    );
    expect(reset.status).toBe(200);
    expect(reset.headers['set-cookie']).toBeUndefined();
    expect((reset.body as { closedSessionCount: number }).closedSessionCount).toBeGreaterThan(0);

    const reused: request.Response = await send(
      'post',
      '/v1/auth/password-reset/confirmation',
      undefined,
      { token: resetToken, newPassword: RESET_PASSWORD },
    );
    expect(reused.status).toBe(422);
    expect(reused.body).toMatchObject({
      code: 'auth.reset-link-expired',
      title: 'Ce lien a expiré',
    });
    expect((await send('get', '/v1/me', token)).status).toBe(401);
    expect(identity.actorsOf('POST', '/internal/v1/auth/password-reset')).toEqual([
      'anonymous',
      'anonymous',
      'anonymous',
      'anonymous',
    ]);
  });

  it('schedules the deletion: the cookie is cleared and the session ends', async () => {
    const token: string = await signIn(NEW_EMAIL, RESET_PASSWORD);

    const scheduled: request.Response = await send('post', '/v1/me/deletion', token, {});

    expect(scheduled.status).toBe(202);
    expect(scheduled.headers['set-cookie']).toEqual([
      '__Host-cw_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);
    expect(typeof (scheduled.body as { deleteAt?: unknown }).deleteAt).toBe('string');
    const after: request.Response = await send('get', '/v1/me', token);
    expect(after.status).toBe(401);
    expect(after.body).toMatchObject({ code: 'auth.session-expired' });
  });

  it('sends identity-service the session the introspection returned, signed as its user', () => {
    const security = identity.calls.filter((call) =>
      /^\/internal\/v1\/(?:users\/[^/]+\/(?:password|email-change|deletion|sessions)|sessions\/[^/]+\/(?:reauthentication|revoke-others))/u.test(
        call.path,
      ),
    );
    expect(security.length).toBeGreaterThan(0);
    expect(security.every((call) => call.principal.actor.type === 'user')).toBe(true);
    expect(security.every((call) => call.principal.actor.id === CAMILLE.id)).toBe(true);
  });

  it('writes no password, reset token, code or session token into the logs', () => {
    const logs: string = logLines.join('\n');

    expect(logLines.length).toBeGreaterThan(0);
    for (const secret of [PASSWORD, CHANGED_PASSWORD, RESET_PASSWORD, ...identity.issuedTokens]) {
      expect(logs).not.toContain(secret);
    }
    for (const body of identity.bodies) {
      if (typeof body.token === 'string') {
        expect(logs).not.toContain(body.token);
      }
    }
    expect(logs).not.toContain('"731406"');
    expect(logs).not.toMatch(/__Host-cw_session=[^;\s"]/u);
  });
});
