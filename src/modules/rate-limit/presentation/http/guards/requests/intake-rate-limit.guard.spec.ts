import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { CountIntakeRequest } from '../../../../application/use-cases/commands/addresses/count-intake-request/count-intake-request.use-case.js';
import { IntakeRateLimitGuard } from './intake-rate-limit.guard.js';

/** Supplies a request and records the response headers. */
function contextOf(method: string, headers: Map<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, ip: '::ffff:203.0.113.7', params: { publicKey: 'secret' } }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => headers.set(name, value),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('IntakeRateLimitGuard', () => {
  it('counts reads and submissions under separate pseudonymized address keys', async () => {
    const reads = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const submissions = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const guard = new IntakeRateLimitGuard(
      new CountIntakeRequest(
        { consume: reads, peek: vi.fn() },
        { consume: submissions, peek: vi.fn() },
        { pseudonymize: (address) => `hashed-${address}` },
      ),
    );

    await guard.canActivate(contextOf('GET', new Map()));
    await guard.canActivate(contextOf('HEAD', new Map()));
    await guard.canActivate(contextOf('POST', new Map()));
    expect(reads).toHaveBeenCalledWith('intake-read:hashed-203.0.113.7');
    expect(reads).toHaveBeenCalledTimes(2);
    expect(submissions).toHaveBeenCalledWith('intake-submit:hashed-203.0.113.7');
  });

  it('answers an anonymous 429 with Retry-After for a refused submission', async () => {
    const guard = new IntakeRateLimitGuard(
      new CountIntakeRequest(
        { consume: vi.fn(), peek: vi.fn() },
        {
          consume: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 27 }),
          peek: vi.fn(),
        },
        { pseudonymize: () => 'hashed' },
      ),
    );
    const headers = new Map<string, string>();
    const error: unknown = await guard
      .canActivate(contextOf('POST', headers))
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ProblemException);
    expect((error as ProblemException).problem).toMatchObject({
      status: 429,
      code: 'rate-limit.exceeded',
    });
    expect(headers.get('Retry-After')).toBe('27');
  });
});
