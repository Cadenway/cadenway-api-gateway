import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { CountIntakeRequest } from '../../../../application/use-cases/commands/addresses/count-intake-request/count-intake-request.use-case.js';
import { IntakeRateLimitGuard } from './intake-rate-limit.guard.js';

/** Supplies a request and records the response headers. */
function contextOf(
  method: string,
  headers: Map<string, string>,
  attachment = false,
): ExecutionContext {
  const handler = () => undefined;
  if (attachment) IntakeRateLimitGuard.attachments()(handler);
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ method, ip: '::ffff:203.0.113.7', params: { publicKey: 'secret' } }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => headers.set(name, value),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('IntakeRateLimitGuard', () => {
  it('counts reads, submissions, and attachment mutations under independent address keys', async () => {
    const reads = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const submissions = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const attachments = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const guard = new IntakeRateLimitGuard(
      new CountIntakeRequest(
        {
          read: { consume: reads, peek: vi.fn() },
          submit: { consume: submissions, peek: vi.fn() },
          attachment: { consume: attachments, peek: vi.fn() },
        },
        { pseudonymize: (address) => `hashed-${address}` },
      ),
      new Reflector(),
    );

    await guard.canActivate(contextOf('GET', new Map()));
    await guard.canActivate(contextOf('HEAD', new Map()));
    await guard.canActivate(contextOf('POST', new Map()));
    await guard.canActivate(contextOf('POST', new Map(), true));
    await guard.canActivate(contextOf('POST', new Map(), true));
    await guard.canActivate(contextOf('DELETE', new Map(), true));
    expect(reads).toHaveBeenCalledWith('intake-read:hashed-203.0.113.7');
    expect(reads).toHaveBeenCalledTimes(2);
    expect(submissions).toHaveBeenCalledExactlyOnceWith('intake-submit:hashed-203.0.113.7');
    expect(attachments.mock.calls).toEqual(
      Array.from({ length: 3 }, () => ['intake-attachment:hashed-203.0.113.7']),
    );
  });

  it.each([false, true])(
    'answers an anonymous 429 with Retry-After (attachment: %s)',
    async (attachment) => {
      const denied = {
        consume: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 27 }),
        peek: vi.fn(),
      };
      const guard = new IntakeRateLimitGuard(
        new CountIntakeRequest(
          {
            read: { consume: vi.fn(), peek: vi.fn() },
            submit: denied,
            attachment: denied,
          },
          { pseudonymize: () => 'hashed' },
        ),
        new Reflector(),
      );
      const headers = new Map<string, string>();
      const error: unknown = await guard
        .canActivate(contextOf('POST', headers, attachment))
        .catch((value: unknown) => value);

      expect(error).toBeInstanceOf(ProblemException);
      expect((error as ProblemException).problem).toMatchObject({
        status: 429,
        code: 'rate-limit.exceeded',
      });
      expect(headers.get('Retry-After')).toBe('27');
    },
  );
});
