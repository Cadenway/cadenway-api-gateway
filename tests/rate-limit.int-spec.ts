import { Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IdentityServiceClient } from '../src/clients/identity-service.client.js';
import { OrganizationServiceClient } from '../src/clients/organization-service.client.js';
import { createGatewayApplication } from '../src/gateway-application.js';
import {
  CAMILLE,
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
  identityProblem,
  MEMBERS_API_TOKEN,
  MEMBERS_TOKEN,
  type FakeIdentity,
  type IntrospectedApiToken,
} from './support/fake-identity.js';
import { CAMILLE_MEMBER, createFakeOrganization } from './support/fake-organization.js';
import { expectPublicResponse } from './support/public-contract.js';
import { redisImage } from './support/redis-image.js';
import { ALLOWED_ORIGIN, testConfig } from './support/test-environment.js';

/**
 * The client addresses of the per-address limits, as Traefik writes them in `X-Forwarded-For`
 * (documentation ranges of RFC 5737 and RFC 3849).
 */
const ADDRESSES = {
  /** Signs in until refused. */
  signIn: '203.0.113.10',
  /** Signs in once, and presents a valid token, from another address. */
  other: '203.0.113.11',
  /** Presents bearer tokens that fail. */
  bearer: '203.0.113.20',
  /** An IPv6 client. */
  ipv6: '2001:db8:85a3:7::1',
  /** Another IPv6 client of the same /64. */
  neighbour: '2001:db8:85a3:7:ffff::2',
} as const;

/**
 * Builds the secret of an unknown personal API token: the format of the contract, which the
 * introspection does not find.
 *
 * @param number - Distinguishes the tokens.
 * @returns The secret.
 */
function unknownToken(number: number): string {
  return `cw_pat_UnknownTokenNumber${String(number).padStart(18, '0')}`;
}

/**
 * Secret of a second personal API token with `members:read`, of another user.
 */
const OTHER_TOKEN = 'cw_pat_AnotherMembersReadTokenOfInes0000000';

/**
 * The second token, as its introspection returns it.
 */
const OTHER_API_TOKEN: IntrospectedApiToken = {
  ...MEMBERS_API_TOKEN,
  apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e99',
  userId: '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31',
};

describe('rate limit on Redis', () => {
  const logLines: string[] = [];
  let redis: StartedRedisContainer;
  let identity: FakeIdentity;
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    redis = await new RedisContainer(redisImage()).start();
    const sink: Writable = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
        done();
      },
    });
    // The whole gateway, its Redis counters included; only the internal services are faked.
    app = await createGatewayApplication(testConfig({ REDIS_URL: redis.getConnectionUrl() }), sink);
    identity = createFakeIdentity();
    const tokens: ReadonlyMap<string, IntrospectedApiToken> = new Map([
      [MEMBERS_TOKEN, MEMBERS_API_TOKEN],
      [OTHER_TOKEN, OTHER_API_TOKEN],
    ]);
    identity.introspectApiToken.mockImplementation((token: string) =>
      Promise.resolve(tokens.get(token) ?? null),
    );
    const organization = createFakeOrganization();
    organization.listMembers.mockResolvedValue({
      items: [CAMILLE_MEMBER],
      nextCursor: null,
      total: 1,
      counts: { owner: 1, admin: 0, member: 0, guest: 0 },
    });
    Object.assign(app.get(IdentityServiceClient), identity);
    Object.assign(app.get(OrganizationServiceClient), organization);
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    // The counters live in Redis once its connection is ready; until then they are counted in
    // memory, which `redis-request-counter.adapter.int-spec.ts` covers.
    const deadline: number = Date.now() + 10_000;
    while ((await request(server).get('/health/ready')).status !== 200 && Date.now() < deadline) {
      await delay(100);
    }
  });

  afterAll(async () => {
    await app.close();
    await redis.stop();
  });

  /**
   * Lists the members with a personal API token.
   *
   * @param token - Secret of the token.
   * @returns The response.
   */
  function listMembers(token: string): request.Test {
    return request(server).get('/v1/members').set('Authorization', `Bearer ${token}`);
  }

  it('answers the 601st request of a token in a minute 429 with Retry-After, while another token and a session are unaffected', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 600; attempt += 1) {
      statuses.push((await listMembers(MEMBERS_TOKEN)).status);
    }
    const refused: request.Response = await listMembers(MEMBERS_TOKEN);
    const other: request.Response = await listMembers(OTHER_TOKEN);
    const session: request.Response = await request(server)
      .get('/v1/members')
      .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`);

    expect(statuses.every((status: number) => status === 200)).toBe(true);
    expectPublicResponse('get', '/v1/members', refused);
    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({
      type: 'about:blank',
      title: 'Trop de requêtes : réessayez dans un instant.',
      status: 429,
      code: 'rate-limit.exceeded',
      detail: 'Too many requests for this credential; retry after the delay of Retry-After.',
    });
    const retryAfter = Number(refused.headers['retry-after']);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(refused.headers.ratelimit).toBeUndefined();
    expect(other.status).toBe(200);
    expect(session.status).toBe(200);
  });

  it('keys the counters by the id of the credential, never by its secret', async () => {
    const redisClient: Redis = new Redis(redis.getConnectionUrl());
    let keys: string[];
    try {
      keys = await redisClient.keys('*');
    } finally {
      redisClient.disconnect();
    }

    expect(keys).toContain(`rate-limit:api-token:${MEMBERS_API_TOKEN.apiTokenId}`);
    expect(keys).toContain(`rate-limit:api-token:${OTHER_API_TOKEN.apiTokenId}`);
    expect(keys.some((key: string) => key.startsWith('rate-limit:session:'))).toBe(true);
    expect(keys.join('\n')).not.toContain('cw_pat_');
    expect(keys.join('\n')).not.toContain(CAMILLE_ORGANIZATION_TOKEN);
  });

  /**
   * Signs in with a wrong password from a client address, as the web application does.
   *
   * @param address - The address Traefik saw.
   * @returns The response.
   */
  function signIn(address: string): request.Test {
    return request(server)
      .post('/v1/auth/sign-in')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .set('X-Forwarded-For', address)
      .send({ email: CAMILLE.email, password: 'not-the-password-of-camille' });
  }

  /**
   * Lists the members with a raw `Authorization` header from a client address.
   *
   * @param authorization - The header.
   * @param address - The address Traefik saw.
   * @returns The response.
   */
  function listMembersFrom(authorization: string, address: string): request.Test {
    return request(server)
      .get('/v1/members')
      .set('Authorization', authorization)
      .set('X-Forwarded-For', address);
  }

  it('answers the 61st sign-in without a credential in a minute from one address 429 with Retry-After, before identity-service, while another address passes', async () => {
    identity.signInWithPassword.mockRejectedValue(
      identityProblem(422, 'auth.invalid-credentials', { remainingAttempts: 3 }),
    );
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 60; attempt += 1) {
      statuses.push((await signIn(ADDRESSES.signIn)).status);
    }
    const refused: request.Response = await signIn(ADDRESSES.signIn);
    const calls: number = identity.signInWithPassword.mock.calls.length;
    const other: request.Response = await signIn(ADDRESSES.other);

    expect(statuses.every((status: number) => status === 422)).toBe(true);
    expectPublicResponse('post', '/v1/auth/sign-in', refused);
    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({
      type: 'about:blank',
      title: 'Trop de requêtes : réessayez dans un instant.',
      status: 429,
      code: 'rate-limit.exceeded',
      detail: 'Too many requests from this client; retry after the delay of Retry-After.',
    });
    const retryAfter = Number(refused.headers['retry-after']);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(calls).toBe(60);
    expect(other.status).toBe(422);
  });

  it('lets a valid token and a session through from the address the anonymous limit refuses', async () => {
    const token: request.Response = await listMembersFrom(
      `Bearer ${OTHER_TOKEN}`,
      ADDRESSES.signIn,
    );
    const session: request.Response = await request(server)
      .get('/v1/members')
      .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
      .set('X-Forwarded-For', ADDRESSES.signIn);

    expect(token.status).toBe(200);
    expect(session.status).toBe(200);
  });

  it('answers the 11th failed bearer token of an address 429 with Retry-After without calling identity-service', async () => {
    identity.introspectApiToken.mockClear();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      // Malformed tokens, refused without a call, count as unknown ones do.
      const bearer: string =
        attempt % 2 === 0 ? 'Bearer not-a-token' : `Bearer ${unknownToken(attempt)}`;
      statuses.push((await listMembersFrom(bearer, ADDRESSES.bearer)).status);
    }
    const introspections: number = identity.introspectApiToken.mock.calls.length;
    const refused: request.Response = await listMembersFrom(
      `Bearer ${unknownToken(99)}`,
      ADDRESSES.bearer,
    );
    const valid: request.Response = await listMembersFrom(
      `Bearer ${OTHER_TOKEN}`,
      ADDRESSES.bearer,
    );
    const afterRefusals: number = identity.introspectApiToken.mock.calls.length;
    const session: request.Response = await request(server)
      .get('/v1/members')
      .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
      .set('X-Forwarded-For', ADDRESSES.bearer);
    const elsewhere: request.Response = await listMembersFrom(
      `Bearer ${OTHER_TOKEN}`,
      ADDRESSES.other,
    );

    expect(statuses.every((status: number) => status === 401)).toBe(true);
    expect(introspections).toBe(5);
    expectPublicResponse('get', '/v1/members', refused);
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'rate-limit.exceeded' });
    const retryAfter = Number(refused.headers['retry-after']);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
    // Past the limit no token of the address is introspected, so a valid one is refused too.
    expect(valid.status).toBe(429);
    expect(afterRefusals).toBe(introspections);
    expect(session.status).toBe(200);
    expect(elsewhere.status).toBe(200);
  });

  it('counts the IPv6 clients of one /64 together', async () => {
    expect((await signIn(ADDRESSES.ipv6)).status).toBe(422);
    expect((await signIn(ADDRESSES.neighbour)).status).toBe(422);
  });

  it('keys the counters of the addresses by a keyed hash, never by the address', async () => {
    const redisClient: Redis = new Redis(redis.getConnectionUrl());
    let keys: string[];
    let counts: number[];
    try {
      keys = await redisClient.keys('*');
      const anonymous: string[] = keys.filter((key: string) =>
        key.startsWith('rate-limit:anonymous:'),
      );
      counts = (await Promise.all(anonymous.map((key: string) => redisClient.get(key)))).map(
        Number,
      );
    } finally {
      redisClient.disconnect();
    }

    // One counter per IPv4 address, one for the /64 of both IPv6 clients.
    expect([...counts].sort((left: number, right: number) => left - right)).toEqual([1, 2, 61]);
    const addressKeys: string[] = keys.filter(
      (key: string) =>
        key.startsWith('rate-limit:anonymous:') || key.startsWith('rate-limit:bearer-failures:'),
    );
    expect(addressKeys).toHaveLength(4);
    expect(
      addressKeys.every((key: string) =>
        /^rate-limit:(?:anonymous|bearer-failures):[\w-]{22}$/u.test(key),
      ),
    ).toBe(true);
    const all: string = keys.join('\n');
    for (const address of [...Object.values(ADDRESSES), '127.0.0.1', '2001:db8', '::ffff:']) {
      expect(all).not.toContain(address);
    }
  });

  it('writes no token secret and no client address into the logs', () => {
    const logs: string = logLines.join('\n');

    expect(logs).not.toContain(MEMBERS_TOKEN);
    expect(logs).not.toContain(OTHER_TOKEN);
    expect(logs).not.toContain(CAMILLE_ORGANIZATION_TOKEN);
    for (const address of Object.values(ADDRESSES)) {
      expect(logs).not.toContain(address);
    }
  });
});
