import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { attachVerifiedCredential } from '../../../../../../presentation/http/session/request-session.js';
import { CountRequest } from '../../../../application/use-cases/commands/requests/count-request/count-request.use-case.js';
import type { RequestAllowance } from '../../../../application/models/requests/request-allowance.model.js';
import { RateLimitGuard } from './rate-limit.guard.js';

/**
 * Function contextOf
 *
 * @description
 * An HTTP execution context around a request and a response that records its headers.
 *
 * @param {object} request - The request.
 * @param {Map<string, string>} headers - Where the response headers are recorded.
 * @returns {ExecutionContext} The context.
 */
function contextOf(request: object, headers: Map<string, string>): ExecutionContext {
  const response = {
    setHeader: (name: string, value: string): void => {
      headers.set(name, value);
    },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

/**
 * Function guardAnswering
 *
 * @description
 * A guard whose counter answers an allowance.
 *
 * @param {RequestAllowance} allowance - What the counter answers.
 * @returns {{ guard: RateLimitGuard; consume: ReturnType<typeof vi.fn> }} The guard and the mock.
 */
function guardAnswering(allowance: RequestAllowance): {
  guard: RateLimitGuard;
  consume: ReturnType<typeof vi.fn>;
} {
  const consume = vi.fn(() => Promise.resolve(allowance));
  return { guard: new RateLimitGuard(new CountRequest({ consume })), consume };
}

describe('RateLimitGuard', () => {
  it('lets a request without a verified credential through, counting nothing', async () => {
    const { guard, consume } = guardAnswering({ allowed: false, retryAfterSeconds: 5 });

    await expect(guard.canActivate(contextOf({}, new Map()))).resolves.toBe(true);
    expect(consume).not.toHaveBeenCalled();
  });

  it('counts the request on the id of its credential, never on a secret', async () => {
    const { guard, consume } = guardAnswering({ allowed: true, retryAfterSeconds: 0 });
    const request: object = {};
    attachVerifiedCredential(request, { kind: 'api-token', id: 'token-id', userId: 'user-id' });

    await expect(guard.canActivate(contextOf(request, new Map()))).resolves.toBe(true);
    expect(consume).toHaveBeenCalledWith('api-token:token-id');
  });

  it('answers 429 rate-limit.exceeded with Retry-After beyond the quota', async () => {
    const { guard } = guardAnswering({ allowed: false, retryAfterSeconds: 42 });
    const request: object = {};
    const headers: Map<string, string> = new Map<string, string>();
    attachVerifiedCredential(request, { kind: 'session', id: 'session-id', userId: 'user-id' });

    const refusal: unknown = await guard
      .canActivate(contextOf(request, headers))
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ProblemException);
    expect((refusal as ProblemException).problem).toMatchObject({
      status: 429,
      code: 'rate-limit.exceeded',
      title: 'Trop de requêtes : réessayez dans un instant.',
    });
    expect(headers.get('Retry-After')).toBe('42');
    expect([...headers.keys()]).toEqual(['Retry-After']);
  });
});
