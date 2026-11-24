import { Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGatewayApplication } from '../src/gateway-application.js';
import { redisImage } from './support/redis-image.js';
import { ALLOWED_ORIGIN, testConfig } from './support/test-environment.js';

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
  let appClosed = false;
  let server: App;

  beforeAll(async () => {
    redis = await new RedisContainer(redisImage()).start();
    redisAddress = `${redis.getHost()}:${String(redis.getMappedPort(6379))}`;
    const sink: Writable = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
        logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
        done();
      },
    });
    // Service addresses nothing listens on: no route of this file calls a service.
    app = await createGatewayApplication(testConfig({ REDIS_URL: redis.getConnectionUrl() }), sink);
    // A real listener on a free loopback port: the shutdown test probes it while the application
    // stops.
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
  });

  afterAll(async () => {
    if (!appClosed) {
      await app.close();
    }
    if (!redisStopped) {
      await redis.stop();
    }
  });

  it('answers the liveness route', async () => {
    await request(server).get('/health/live').expect(200);
  });

  it('is ready while Redis answers', async () => {
    const response: request.Response = await readinessStatus(server, 200);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', info: { redis: { status: 'up' } } });
  });

  it.each(['PATCH', 'QUERY'])('accepts a %s preflight from an allowed origin', async (method) => {
    const response: request.Response = await request(server)
      .options('/v1/tasks/CAD-482')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', 'content-type,if-match,if-organization-match');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain(method);
    expect(response.headers['access-control-allow-headers']).toBe(
      'Content-Type,If-Match,If-Organization-Match,Idempotency-Key,Intake-Draft-Key',
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

  it('exposes a malformed QUERY JSON error to an allowed origin', async () => {
    const query = request(server) as unknown as { query: (url: string) => request.Test };
    const response: request.Response = await query
      .query('/v1/members')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 400, code: 'request.invalid' });
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
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
    expect(response.headers['access-control-expose-headers']).toContain('Content-Disposition');
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

    const outages: string[] = logLines.filter((line: string) => line.includes('redis unreachable'));

    expect(outages).toHaveLength(1);
    expect(JSON.parse(outages[0] ?? '{}')).toMatchObject({
      level: 'warn',
      context: 'Redis',
      connection: 'api-gateway',
      msg: 'redis unreachable',
    });
    expect(outages[0]).not.toContain(redisAddress);
  });

  it('answers 503 on readiness from the start of the stop, and stops without an unhandled rejection while Redis is down', async () => {
    const rejections: unknown[] = [];
    const collect = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', collect);
    try {
      // The listener stays open for the shutdown delay, which is when the probes below run.
      const closing: Promise<void> = app.close();
      let ready: request.Response = await request(server).get('/health/ready');
      const deadline: number = Date.now() + 2_000;
      while (
        (ready.body as { error?: { shutdown?: unknown } }).error?.shutdown === undefined &&
        Date.now() < deadline
      ) {
        await delay(100);
        ready = await request(server).get('/health/ready');
      }
      const live: request.Response = await request(server).get('/health/live');
      await closing;
      appClosed = true;
      await delay(500);

      expect(ready.status).toBe(503);
      expect(ready.body).toEqual({
        status: 'error',
        info: {},
        error: { shutdown: { status: 'down', message: 'shutting down' } },
        details: { shutdown: { status: 'down', message: 'shutting down' } },
      });
      expect(live.status).toBe(200);
    } finally {
      process.off('unhandledRejection', collect);
    }

    expect(rejections).toEqual([]);
    expect(logLines.filter((line: string) => line.includes('redis command failed'))).toEqual([]);
  });
});
