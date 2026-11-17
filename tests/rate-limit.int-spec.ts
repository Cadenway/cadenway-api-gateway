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
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
  MEMBERS_API_TOKEN,
  MEMBERS_TOKEN,
  type FakeIdentity,
  type IntrospectedApiToken,
} from './support/fake-identity.js';
import { CAMILLE_MEMBER, createFakeOrganization } from './support/fake-organization.js';
import { expectPublicResponse } from './support/public-contract.js';
import { redisImage } from './support/redis-image.js';
import { testConfig } from './support/test-environment.js';

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

  it('writes no token secret into the logs', () => {
    const logs: string = logLines.join('\n');

    expect(logs).not.toContain(MEMBERS_TOKEN);
    expect(logs).not.toContain(OTHER_TOKEN);
    expect(logs).not.toContain(CAMILLE_ORGANIZATION_TOKEN);
  });
});
