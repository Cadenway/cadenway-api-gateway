import { ProblemException } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { relaySiteSubmission } from './site-submission-relay.mapper.js';

describe('public site submission relay', () => {
  it.each([
    [409, 'idempotency.request-in-progress'],
    [422, 'idempotency.key-reused'],
    [503, 'upstream.timeout'],
  ] as const)('returns declared %s problems without private details', async (status, code) => {
    const result: unknown = await relaySiteSubmission('contact', () =>
      Promise.reject(new ProblemException({ status, code, detail: 'private message' })),
    ).catch((error: unknown) => error);
    expect(result).toMatchObject({ problem: { status, code } });
    expect(JSON.stringify(result)).not.toContain('private message');
  });

  it('maps unexpected failures to a fixed unavailable problem', async () => {
    const result: unknown = await relaySiteSubmission('newsletter', () =>
      Promise.reject(new Error('private message')),
    ).catch((error: unknown) => error);
    expect(result).toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(JSON.stringify(result)).not.toContain('private message');
  });

  it.each([
    [409, 'idempotency.request-in-progress'],
    [422, 'idempotency.key-reused'],
  ] as const)('does not expose contact error %s on newsletter signup', async (status, code) => {
    const result: unknown = await relaySiteSubmission('newsletter', () =>
      Promise.reject(new ProblemException({ status, code, detail: 'private message' })),
    ).catch((error: unknown) => error);
    expect(result).toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(JSON.stringify(result)).not.toContain('private message');
  });

  it.each(['auth.issuer-not-allowed', 'auth.actor-not-allowed', 'auth.organization-required'])(
    'maps internal authorization failure %s without private details',
    async (code) => {
      const result: unknown = await relaySiteSubmission('newsletter', () =>
        Promise.reject(
          new ProblemException({
            status: 403,
            code,
            detail: 'private message',
            cause: new Error('private cause'),
          }),
        ),
      ).catch((error: unknown) => error);
      expect(result).toMatchObject({ problem: { status: 503, code: 'upstream.unauthorized' } });
      expect(JSON.stringify(result)).not.toContain('private');
      expect((result as Error).cause).toBeUndefined();
    },
  );
});
