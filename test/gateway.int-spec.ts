import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Constant ALLOWED_ORIGIN
 *
 * @description
 * Origin of the web application in this test; the only other allowed one is the website.
 *
 * @type {string}
 */
const ALLOWED_ORIGIN = 'https://app.cadenway.test';

/**
 * Function redisImage
 *
 * @description
 * Reads the Redis image of `compose.dev.yaml`, so the tests run the image the workstation runs and
 * the pin Renovate updates lives in one file.
 *
 * @returns {string} The image reference, tag and digest.
 * @throws {Error} When `compose.dev.yaml` names no Redis image.
 */
function redisImage(): string {
  const compose: string = readFileSync(new URL('../compose.dev.yaml', import.meta.url), 'utf8');
  const image: string | undefined = /^\s*image:\s*(redis:\S+)\s*$/mu.exec(compose)?.[1];
  if (image === undefined) {
    throw new Error('compose.dev.yaml names no Redis image.');
  }
  return image;
}

/**
 * Function testEnvironment
 *
 * @description
 * Environment of the gateway under test: the disposable Redis, a signing key generated for this
 * run (no key is ever committed) and service addresses nothing listens on, since no route calls a
 * service yet.
 *
 * @param {string} redisUrl - Address of the disposable Redis.
 * @returns {Record<string, string>} The variables to stub.
 */
function testEnvironment(redisUrl: string): Record<string, string> {
  const jwk: JsonWebKey = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  const privateJwk: string = JSON.stringify({
    kty: 'OKP',
    crv: 'Ed25519',
    x: jwk.x,
    d: jwk.d,
    kid: randomBytes(8).toString('hex'),
  });
  return {
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'info',
    REDIS_URL: redisUrl,
    ALLOWED_ORIGINS: `${ALLOWED_ORIGIN},https://cadenway.test`,
    INTERNAL_TOKEN_ISSUER: 'api-gateway',
    INTERNAL_TOKEN_PRIVATE_JWK: privateJwk,
    IDENTITY_SERVICE_URL: 'http://127.0.0.1:1',
    ORGANIZATION_SERVICE_URL: 'http://127.0.0.1:1',
    BILLING_SERVICE_URL: 'http://127.0.0.1:1',
    TASK_SERVICE_URL: 'http://127.0.0.1:1',
    DOCUMENT_SERVICE_URL: 'http://127.0.0.1:1',
    STORAGE_SERVICE_URL: 'http://127.0.0.1:1',
    NOTIFICATION_SERVICE_URL: 'http://127.0.0.1:1',
    AUTOMATION_SERVICE_URL: 'http://127.0.0.1:1',
    INTEGRATION_SERVICE_URL: 'http://127.0.0.1:1',
    SEARCH_SERVICE_URL: 'http://127.0.0.1:1',
  };
}

/**
 * Function readinessStatus
 *
 * @description
 * Polls `/health/ready` until it answers the expected status or the time runs out: the client
 * notices a stopped server when its socket closes, a moment after the container is gone.
 *
 * @param {App} server - HTTP server of the application.
 * @param {number} expected - Status to wait for.
 * @returns {Promise<request.Response>} The last readiness response.
 */
async function readinessStatus(server: App, expected: number): Promise<request.Response> {
  const deadline: number = Date.now() + 10_000;
  let response: request.Response = await request(server).get('/health/ready');
  while (response.status !== expected && Date.now() < deadline) {
    await delay(200);
    response = await request(server).get('/health/ready');
  }
  return response;
}

describe('gateway start-up', () => {
  const logLines: string[] = [];
  let redis: StartedRedisContainer;
  let redisStopped = false;
  let redisAddress: string;
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    redis = await new RedisContainer(redisImage()).start();
    redisAddress = `${redis.getHost()}:${String(redis.getMappedPort(6379))}`;
    for (const [name, value] of Object.entries(testEnvironment(redis.getConnectionUrl()))) {
      vi.stubEnv(name, value);
    }
    // The application module validates the environment when it is declared: import it only once
    // the environment is in place.
    const { loadConfig } = await import('@cadenway/nest-common');
    const { appConfigSchema } = await import('../src/config/app-config.js');
    const { createGatewayApplication } = await import('../src/gateway-application.js');
    const sink: Writable = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
        done();
      },
    });
    app = await createGatewayApplication(loadConfig(appConfigSchema), sink);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    if (!redisStopped) {
      await redis.stop();
    }
    vi.unstubAllEnvs();
  });

  it('answers the liveness route', async () => {
    await request(server).get('/health/live').expect(200);
  });

  it('is ready while Redis answers', async () => {
    const response: request.Response = await readinessStatus(server, 200);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', info: { redis: { status: 'up' } } });
  });

  it('accepts a preflight from an allowed origin, with credentials', async () => {
    const response: request.Response = await request(server)
      .options('/v1/tasks')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type,if-match');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    expect(response.headers['access-control-allow-headers']).toBe(
      'Content-Type,If-Match,Idempotency-Key',
    );
    expect(response.headers.vary).toContain('Origin');
  });

  it('refuses a preflight from any other origin', async () => {
    for (const origin of ['https://evil.test', 'https://app.cadenway.test.evil.test', 'null']) {
      const response: request.Response = await request(server)
        .options('/v1/tasks')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('exposes the error reference to an allowed origin and ignores the one a client sends', async () => {
    const response: request.Response = await request(server)
      .get('/v1/unknown')
      .set('Origin', ALLOWED_ORIGIN)
      .set('X-Request-Id', 'chosen-by-the-client');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({ status: 404, code: 'http.not-found' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/u);
    expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('sets the security headers and hides the framework', async () => {
    const response: request.Response = await request(server).get('/health/live');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('trusts exactly one proxy hop', () => {
    const trusted: unknown = app.getHttpAdapter().getInstance().get('trust proxy');

    expect(trusted).toBe(1);
  });

  it('writes one JSON line per request, without the client request id', () => {
    const lines: Record<string, unknown>[] = logLines.map(
      (line: string) => JSON.parse(line) as Record<string, unknown>,
    );
    const completion: Record<string, unknown> | undefined = lines.find(
      (line: Record<string, unknown>) => line.status === 404,
    );

    expect(completion).toMatchObject({ service: 'api-gateway', method: 'GET', status: 404 });
    expect(JSON.stringify(lines)).not.toContain('chosen-by-the-client');
  });

  it('reports Redis down on readiness once Redis stops, and stays alive', async () => {
    await redis.stop();
    redisStopped = true;

    const response: request.Response = await readinessStatus(server, 503);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'error',
      error: { redis: { status: 'down' } },
    });
    await request(server).get('/health/live').expect(200);
  });

  it('logs the outage once while the client keeps reconnecting', async () => {
    // Several reconnection attempts fail within this wait.
    await delay(1_500);

    const outages: string[] = logLines.filter((line: string) =>
      line.includes('Redis is unreachable'),
    );

    expect(outages).toHaveLength(1);
    expect(JSON.parse(outages[0] ?? '{}')).toMatchObject({ level: 'warn', context: 'Redis' });
    expect(outages[0]).not.toContain(redisAddress);
  });
});
