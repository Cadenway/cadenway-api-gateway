import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import { Logger } from '@nestjs/common';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { redisImage } from '../../../../../../tests/support/redis-image.js';
import type { RequestAllowance } from '../../../application/models/requests/request-allowance.model.js';
import { CountWebhookRequest } from '../../../application/use-cases/commands/addresses/count-webhook-request/count-webhook-request.use-case.js';
import { RedisRequestCounter, type RequestQuota } from './redis-request-counter.adapter.js';

/**
 * Constant QUOTA
 *
 * @description
 * The quota of the gateway.
 *
 * @type {RequestQuota}
 */
const QUOTA: RequestQuota = {
  limit: 'credential',
  requests: 600,
  windowSeconds: 60,
  storeTimeoutMs: 100,
};

/**
 * Function consumeTimes
 *
 * @description
 * Counts a number of requests of a key, one after the other.
 *
 * @param {RedisRequestCounter} counter - The counter.
 * @param {string} key - The key.
 * @param {number} times - How many requests.
 * @returns {Promise<RequestAllowance[]>} The allowance of each request.
 */
async function consumeTimes(
  counter: RedisRequestCounter,
  key: string,
  times: number,
): Promise<RequestAllowance[]> {
  const allowances: RequestAllowance[] = [];
  for (let request = 0; request < times; request += 1) {
    allowances.push(await counter.consume(key));
  }
  return allowances;
}

describe('RedisRequestCounter on Redis', () => {
  let redis: StartedRedisContainer;
  let client: ResilientRedisClient;
  let counter: RedisRequestCounter;

  beforeAll(async () => {
    redis = await new RedisContainer(redisImage()).start();
    client = new ResilientRedisClient(redis.getConnectionUrl(), {
      connectionName: 'api-gateway-test',
      enableOfflineQueue: false,
    });
    await new Promise<void>((resolve) => {
      client.once('ready', () => {
        resolve();
      });
    });
    counter = new RedisRequestCounter(client, QUOTA);
  });

  afterAll(async () => {
    await client.shutDown();
    await redis.stop();
  });

  it('allows 600 requests of a key in a minute, refuses the 601st with the seconds left, and keeps other keys apart', async () => {
    const key = `api-token:${randomUUID()}`;
    const other = `api-token:${randomUUID()}`;

    const allowances: RequestAllowance[] = await consumeTimes(counter, key, 601);
    const otherAllowance: RequestAllowance = await counter.consume(other);

    expect(allowances.slice(0, 600).every((allowance) => allowance.allowed)).toBe(true);
    expect(allowances[600]?.allowed).toBe(false);
    expect(allowances[600]?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(allowances[600]?.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(otherAllowance).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('isolates webhook providers and the anonymous quota on Redis', async () => {
    const pseudonym = randomUUID();
    const webhookQuota = { limit: 'webhook', requests: 60, windowSeconds: 60, storeTimeoutMs: 100 };
    const webhook = new CountWebhookRequest(
      {
        github: new RedisRequestCounter(client, webhookQuota),
        gitlab: new RedisRequestCounter(client, webhookQuota),
        stripe: new RedisRequestCounter(client, webhookQuota),
      },
      { pseudonymize: () => pseudonym },
    );

    const github = await Promise.all(
      Array.from({ length: 61 }, () => webhook.execute('203.0.113.7', 'github')),
    );
    expect(github.filter((answer) => answer.allowed)).toHaveLength(60);
    expect(github.find((answer) => !answer.allowed)?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    await expect(webhook.execute('203.0.113.7', 'gitlab')).resolves.toMatchObject({
      allowed: true,
    });
    await expect(webhook.execute('203.0.113.7', 'stripe')).resolves.toMatchObject({
      allowed: true,
    });
    await expect(counter.consume(`anonymous:${pseudonym}`)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(client.get(`rate-limit:webhook-github:${pseudonym}`)).resolves.toBe('61');
    await expect(client.get(`rate-limit:webhook-gitlab:${pseudonym}`)).resolves.toBe('1');
    await expect(client.get(`rate-limit:webhook-stripe:${pseudonym}`)).resolves.toBe('1');
  });

  it('keeps the counter in Redis under the id of the credential, expiring with its window', async () => {
    const key = `session:${randomUUID()}`;

    await counter.consume(key);

    await expect(client.get(`rate-limit:${key}`)).resolves.toBe('1');
    const ttl: number = await client.pttl(`rate-limit:${key}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  it('keeps public intake reads, submissions, and upload mutations in independent address windows', async () => {
    const pseudonym = randomUUID();
    const reads = new RedisRequestCounter(client, {
      limit: 'intake-read',
      requests: 30,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    });
    const submissions = new RedisRequestCounter(client, {
      limit: 'intake-submit',
      requests: 10,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    });
    const attachments = new RedisRequestCounter(client, {
      limit: 'intake-attachment',
      requests: 10,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    });
    const readKey = `intake-read:${pseudonym}`;
    const submitKey = `intake-submit:${pseudonym}`;
    const attachmentKey = `intake-attachment:${pseudonym}`;
    const readResults = await consumeTimes(reads, readKey, 31);
    const submissionResults = await consumeTimes(submissions, submitKey, 11);
    const attachmentResults = await consumeTimes(attachments, attachmentKey, 11);

    expect(readResults.slice(0, 30).every((result) => result.allowed)).toBe(true);
    expect(readResults[30]).toMatchObject({ allowed: false });
    expect(submissionResults.slice(0, 10).every((result) => result.allowed)).toBe(true);
    expect(submissionResults[10]).toMatchObject({ allowed: false });
    expect(submissionResults[10]?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(attachmentResults.slice(0, 10).every((result) => result.allowed)).toBe(true);
    expect(attachmentResults[10]).toMatchObject({ allowed: false });
    expect(attachmentResults[10]?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    await expect(reads.consume(`intake-read:${randomUUID()}`)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('counts in memory while Redis cannot count, logging it once, then in Redis again', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const key = `api-token:${randomUUID()}`;
    try {
      // Redis holds every command for a second: each count waits 100 milliseconds at most.
      await client.client('PAUSE', '1000', 'ALL');

      const paused: RequestAllowance[] = await consumeTimes(counter, key, 3);

      expect(paused.every((allowance) => allowance.allowed)).toBe(true);
      const outages = warn.mock.calls.filter(
        (call) => call[1] === 'rate limit counted in memory: redis cannot count',
      );
      expect(outages).toHaveLength(1);
      expect(outages[0]?.[0]).toMatchObject({ limit: 'credential' });
      expect(JSON.stringify(outages)).not.toContain(key);

      await delay(1_200);
      await counter.consume(`session:${randomUUID()}`);

      expect(log.mock.calls.some((call) => call[1] === 'rate limit counted in redis again')).toBe(
        true,
      );
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('lets one request a second try a stalled Redis while the others count in memory at once', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const stalled: RedisRequestCounter = new RedisRequestCounter(client, {
      limit: 'anonymous',
      requests: 60,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    });
    try {
      await client.client('PAUSE', '3000', 'ALL');
      await stalled.consume(`anonymous:${randomUUID()}`);
      await delay(1_100);

      const durations: number[] = await Promise.all(
        Array.from({ length: 5 }, async () => {
          const started: number = performance.now();
          await stalled.consume(`anonymous:${randomUUID()}`);
          return performance.now() - started;
        }),
      );

      expect(durations.filter((duration: number) => duration >= 80)).toHaveLength(1);
      await delay(2_000);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('reads a counter without counting: room while the quota is not used, the seconds left once it is', async () => {
    const failures: RedisRequestCounter = new RedisRequestCounter(client, {
      limit: 'bearer-failures',
      requests: 3,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    });
    const key = `bearer-failures:${randomUUID()}`;

    const fresh: RequestAllowance = await failures.peek(key);
    await expect(client.exists(`rate-limit:${key}`)).resolves.toBe(0);
    await consumeTimes(failures, key, 2);
    const twice: RequestAllowance = await failures.peek(key);
    await failures.consume(key);
    const used: RequestAllowance = await failures.peek(key);

    expect(fresh).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(twice).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(used.allowed).toBe(false);
    expect(used.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(used.retryAfterSeconds).toBeLessThanOrEqual(60);
    await expect(client.get(`rate-limit:${key}`)).resolves.toBe('3');
  });

  it('reads the counters in memory while Redis cannot answer, as it counts them', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const failures: RedisRequestCounter = new RedisRequestCounter(client, {
      limit: 'bearer-failures',
      requests: 2,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    });
    const key = `bearer-failures:${randomUUID()}`;
    try {
      await client.client('PAUSE', '1000', 'ALL');

      const before: RequestAllowance = await failures.peek(key);
      await consumeTimes(failures, key, 2);
      const after: RequestAllowance = await failures.peek(key);

      expect(before).toEqual({ allowed: true, retryAfterSeconds: 0 });
      expect(after.allowed).toBe(false);
      const outages = warn.mock.calls.filter(
        (call) => call[1] === 'rate limit counted in memory: redis cannot count',
      );
      expect(outages).toHaveLength(1);
      expect(outages[0]?.[0]).toMatchObject({ limit: 'bearer-failures' });
      await delay(1_200);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });
});
