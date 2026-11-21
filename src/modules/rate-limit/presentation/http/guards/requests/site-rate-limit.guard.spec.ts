import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { SiteOperation } from '../../../../application/models/requests/site-operation.model.js';
import { CountSiteRequest } from '../../../../application/use-cases/commands/addresses/count-site-request/count-site-request.use-case.js';
import { SiteRateLimitGuard } from './site-rate-limit.guard.js';

function contextOf(operation: SiteOperation, headers: Map<string, string>): ExecutionContext {
  const handler = () => undefined;
  SiteRateLimitGuard.operation(operation)(handler);
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ ip: '::ffff:203.0.113.7' }),
      getResponse: () => ({ setHeader: (name: string, value: string) => headers.set(name, value) }),
    }),
  } as unknown as ExecutionContext;
}

describe('SiteRateLimitGuard', () => {
  it('counts contact and newsletter in distinct hashed network buckets', async () => {
    const contact = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const newsletter = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    const guard = new SiteRateLimitGuard(
      new CountSiteRequest(
        {
          contact: { consume: contact, peek: vi.fn() },
          newsletter: { consume: newsletter, peek: vi.fn() },
        },
        { pseudonymize: (value) => `hash-${value}` },
      ),
      new Reflector(),
    );
    const headers = new Map<string, string>();
    await guard.canActivate(contextOf('contact', headers));
    expect(headers.get('RateLimit-Policy')).toBe('"contact";q=5;w=60');
    expect(headers.get('Cache-Control')).toBe('no-store');
    await guard.canActivate(contextOf('newsletter', headers));
    expect(headers.get('RateLimit-Policy')).toBe('"newsletter";q=10;w=60');
    expect(contact).toHaveBeenCalledExactlyOnceWith('site-contact:hash-203.0.113.7');
    expect(newsletter).toHaveBeenCalledExactlyOnceWith('site-newsletter:hash-203.0.113.7');
  });

  it.each(['contact', 'newsletter'] as const)(
    'returns 429 with retry and policy for %s',
    async (operation) => {
      const denied = {
        consume: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 23 }),
        peek: vi.fn(),
      };
      const guard = new SiteRateLimitGuard(
        new CountSiteRequest(
          { contact: denied, newsletter: denied },
          { pseudonymize: () => 'hash' },
        ),
        new Reflector(),
      );
      const headers = new Map<string, string>();
      const error: unknown = await guard
        .canActivate(contextOf(operation, headers))
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(ProblemException);
      expect(error).toMatchObject({ problem: { status: 429, code: 'rate-limit.exceeded' } });
      expect(headers.get('Cache-Control')).toBe('no-store');
      expect(headers.get('Retry-After')).toBe('23');
      expect(headers.get('RateLimit')).toBe(`"${operation}";r=0;t=23`);
    },
  );
});
