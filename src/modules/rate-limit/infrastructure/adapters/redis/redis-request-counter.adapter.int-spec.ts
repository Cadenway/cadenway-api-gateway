import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import { Logger } from '@nestjs/common';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { redisImage } from '../../../../../../tests/support/redis-image.js';
import type { RequestAllowance } from '../../../application/models/requests/request-allowance.model.js';
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

  it('keeps the counter in Redis under the id of the credential, expiring with its window', async () => {
    const key = `session:${randomUUID()}`;

    await counter.consume(key);

    await expect(client.get(`rate-limit:${key}`)).resolves.toBe('1');
    const ttl: number = await client.pttl(`rate-limit:${key}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
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
