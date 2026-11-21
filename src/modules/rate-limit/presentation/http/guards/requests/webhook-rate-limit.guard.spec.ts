import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { WebhookProvider } from '../../../../application/models/requests/webhook-provider.model.js';
import { CountWebhookRequest } from '../../../../application/use-cases/commands/addresses/count-webhook-request/count-webhook-request.use-case.js';
import { WebhookRateLimitGuard } from './webhook-rate-limit.guard.js';

/** Creates a proxy-resolved request with attacker-supplied values that must not affect its key. */
function contextOf(provider: WebhookProvider, headers: Map<string, string>): ExecutionContext {
  const handler = () => undefined;
  WebhookRateLimitGuard.provider(provider)(handler);
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '::ffff:203.0.113.7',
        headers: { 'x-forwarded-for': '198.51.100.9', 'x-github-delivery': 'untrusted' },
        query: { bindingId: 'untrusted' },
      }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => headers.set(name, value),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('WebhookRateLimitGuard', () => {
  it('uses separate provider windows keyed by the normalized proxy address', async () => {
    const github = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const gitlab = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const guard = new WebhookRateLimitGuard(
      new CountWebhookRequest(
        { github: { consume: github, peek: vi.fn() }, gitlab: { consume: gitlab, peek: vi.fn() } },
        { pseudonymize: (address) => `hashed-${address}` },
      ),
      new Reflector(),
    );

    await expect(guard.canActivate(contextOf('github', new Map()))).resolves.toBe(true);
    await expect(guard.canActivate(contextOf('gitlab', new Map()))).resolves.toBe(true);
    expect(github).toHaveBeenCalledExactlyOnceWith('webhook-github:hashed-203.0.113.7');
    expect(gitlab).toHaveBeenCalledExactlyOnceWith('webhook-gitlab:hashed-203.0.113.7');
  });

  it.each(['github', 'gitlab'] as const)(
    'returns the webhook policy and retry delay when %s is exhausted',
    async (provider) => {
      const denied = {
        consume: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 27 }),
        peek: vi.fn(),
      };
      const guard = new WebhookRateLimitGuard(
        new CountWebhookRequest({ github: denied, gitlab: denied }, { pseudonymize: () => 'hash' }),
        new Reflector(),
      );
      const headers = new Map<string, string>();
      const error: unknown = await guard
        .canActivate(contextOf(provider, headers))
        .catch((value: unknown) => value);

      expect(error).toBeInstanceOf(ProblemException);
      expect((error as ProblemException).problem).toMatchObject({
        status: 429,
        code: 'rate-limit.exceeded',
      });
      expect(headers.get('Retry-After')).toBe('27');
      expect(headers.get('RateLimit')).toBe(`"${provider}";r=0;t=27`);
      expect(headers.get('RateLimit-Policy')).toBe(`"${provider}";q=60;w=60`);
    },
  );

  it('fails closed when route metadata is missing', async () => {
    const counter = new CountWebhookRequest(
      {
        github: { consume: vi.fn(), peek: vi.fn() },
        gitlab: { consume: vi.fn(), peek: vi.fn() },
      },
      { pseudonymize: () => 'hash' },
    );
    const guard = new WebhookRateLimitGuard(counter, new Reflector());
    const context = { getHandler: () => () => undefined } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow('provider is not configured');
  });
});
