import { ProblemException } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import { createSearchServiceAdapter } from './search-service.adapter.js';

describe('Search service adapter', () => {
  it('replaces upstream validation descriptions with safe messages', async () => {
    const search = vi.fn().mockRejectedValue(
      new ProblemException({
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [
            { in: 'query', path: 'cursor', code: 'invalid_cursor', message: 'private query' },
          ],
        },
      }),
    );
    const adapter = createSearchServiceAdapter({ search });
    await expect(adapter.search({ q: 'SSO', limit: 50 })).rejects.toMatchObject({
      problem: {
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [
            { in: 'query', path: 'cursor', code: 'invalid_cursor', message: 'Invalid value.' },
          ],
        },
      },
    });
  });

  it('fails closed when the upstream problem lacks required validation details', async () => {
    const search = vi
      .fn()
      .mockRejectedValue(new ProblemException({ status: 400, code: 'request.invalid' }));
    await expect(
      createSearchServiceAdapter({ search }).search({ q: 'SSO', limit: 50 }),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it.each(['auth.issuer-not-allowed', 'auth.actor-not-allowed', 'auth.organization-required'])(
    'maps internal refusal %s to upstream.unauthorized without details',
    async (code) => {
      const search = vi
        .fn()
        .mockRejectedValue(
          new ProblemException({ status: 403, code, details: { private: 'hidden' } }),
        );
      try {
        await createSearchServiceAdapter({ search }).search({ q: 'SSO', limit: 50 });
        throw new Error('Expected an internal authorization failure.');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ProblemException);
        if (!(error instanceof ProblemException)) throw error;
        expect(error.problem).toMatchObject({ status: 503, code: 'upstream.unauthorized' });
        expect(error.problem.details).toBeUndefined();
      }
    },
  );

  it('maps other internal forbidden responses to upstream.failed', async () => {
    const search = vi
      .fn()
      .mockRejectedValue(new ProblemException({ status: 403, code: 'access.other' }));
    await expect(
      createSearchServiceAdapter({ search }).search({ q: 'SSO', limit: 50 }),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });
});
