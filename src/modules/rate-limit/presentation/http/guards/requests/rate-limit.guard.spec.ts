import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { attachVerifiedCredential } from '../../../../../../presentation/http/session/request-session.js';
import { CountAnonymousRequest } from '../../../../application/use-cases/commands/addresses/count-anonymous-request/count-anonymous-request.use-case.js';
import { CountRequest } from '../../../../application/use-cases/commands/requests/count-request/count-request.use-case.js';
import type { RequestAllowance } from '../../../../application/models/requests/request-allowance.model.js';
import { RateLimitGuard } from './rate-limit.guard.js';

/**
 * Constant ALLOWED
 *
 * @description
 * What a counter answers for a request within its quota.
 *
 * @type {RequestAllowance}
 */
const ALLOWED: RequestAllowance = { allowed: true, retryAfterSeconds: 0 };

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
 * A guard whose credential counter and anonymous counter answer allowances. The pseudonym of an
 * address is `pseudonym-of-<address>`.
 *
 * @param {RequestAllowance} credential - What the counter of the credentials answers.
 * @param {RequestAllowance} anonymous - What the counter of the requests without one answers.
 * @returns {{ guard: RateLimitGuard; consume: ReturnType<typeof vi.fn>; consumeAnonymous: ReturnType<typeof vi.fn> }} The guard and the mocks.
 */
function guardAnswering(
  credential: RequestAllowance,
  anonymous: RequestAllowance = ALLOWED,
): {
  guard: RateLimitGuard;
  consume: ReturnType<typeof vi.fn>;
  consumeAnonymous: ReturnType<typeof vi.fn>;
} {
  const consume = vi.fn(() => Promise.resolve(credential));
  const consumeAnonymous = vi.fn(() => Promise.resolve(anonymous));
  const guard: RateLimitGuard = new RateLimitGuard(
    new CountRequest({ consume, peek: vi.fn() }),
    new CountAnonymousRequest(
      { consume: consumeAnonymous, peek: vi.fn() },
      { pseudonymize: (address: string): string => `pseudonym-of-${address}` },
    ),
  );
  return { guard, consume, consumeAnonymous };
}

describe('RateLimitGuard', () => {
  it('counts a request without a verified credential on the pseudonym of its client address', async () => {
    const { guard, consume, consumeAnonymous } = guardAnswering({
      allowed: false,
      retryAfterSeconds: 5,
    });

    await expect(guard.canActivate(contextOf({ ip: '203.0.113.7' }, new Map()))).resolves.toBe(
      true,
    );
    expect(consumeAnonymous).toHaveBeenCalledWith('anonymous:pseudonym-of-203.0.113.7');
    expect(consume).not.toHaveBeenCalled();
  });

  it('counts an IPv4 client of a dual-stack socket as its IPv4 address', async () => {
    const { guard, consumeAnonymous } = guardAnswering(ALLOWED);

    await guard.canActivate(contextOf({ ip: '::ffff:203.0.113.7' }, new Map()));

    expect(consumeAnonymous).toHaveBeenCalledWith('anonymous:pseudonym-of-203.0.113.7');
  });

  it('answers 429 rate-limit.exceeded with Retry-After beyond the quota of the address', async () => {
    const { guard } = guardAnswering(ALLOWED, { allowed: false, retryAfterSeconds: 37 });
    const headers: Map<string, string> = new Map<string, string>();

    const refusal: unknown = await guard
      .canActivate(contextOf({ ip: '203.0.113.7' }, headers))
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ProblemException);
    expect((refusal as ProblemException).problem).toMatchObject({
      status: 429,
      code: 'rate-limit.exceeded',
      title: 'Trop de requêtes : réessayez dans un instant.',
      detail: 'Too many requests from this client; retry after the delay of Retry-After.',
    });
    expect(headers.get('Retry-After')).toBe('37');
    expect([...headers.keys()]).toEqual(['Retry-After']);
  });

  it('counts the request on the id of its credential, never on a secret nor on its address', async () => {
    const { guard, consume, consumeAnonymous } = guardAnswering(ALLOWED, {
      allowed: false,
      retryAfterSeconds: 5,
    });
    const request: object = { ip: '203.0.113.7' };
    attachVerifiedCredential(request, { kind: 'api-token', id: 'token-id', userId: 'user-id' });

    await expect(guard.canActivate(contextOf(request, new Map()))).resolves.toBe(true);
    expect(consume).toHaveBeenCalledWith('api-token:token-id');
    expect(consumeAnonymous).not.toHaveBeenCalled();
  });

  it('answers 429 rate-limit.exceeded with Retry-After beyond the quota of the credential', async () => {
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
      detail: 'Too many requests for this credential; retry after the delay of Retry-After.',
    });
    expect(headers.get('Retry-After')).toBe('42');
    expect([...headers.keys()]).toEqual(['Retry-After']);
  });
});
