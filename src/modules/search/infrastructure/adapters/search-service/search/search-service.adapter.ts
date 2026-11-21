import { ProblemException } from '@cadenway/nest-common';
import { z } from 'zod';

import type { SearchServiceClient } from '../../../../../../clients/search-service.client.js';
import type { SearchPort } from '../../../../application/ports/outbound/search-service/search/search.port.js';

const issue = z.object({
  in: z.literal('query'),
  path: z.enum(['', 'q', 'cursor', 'limit']),
  code: z.enum([
    'invalid_cursor',
    'invalid_type',
    'too_big',
    'too_small',
    'unrecognized_keys',
    'custom',
  ]),
});

/** Removes upstream-provided text and details before public problem translation. */
export function createSearchServiceAdapter(
  client: Pick<SearchServiceClient, 'search'>,
): SearchPort {
  return {
    async search(query): Promise<object> {
      try {
        return await client.search(query);
      } catch (error: unknown) {
        if (!(error instanceof ProblemException)) throw error;
        const { status, code, details } = error.problem;
        if (status === 400 && code === 'request.invalid') {
          const issues = Array.isArray(details?.issues)
            ? details.issues.flatMap((value: unknown) => {
                const parsed = issue.safeParse(value);
                return parsed.success ? [{ ...parsed.data, message: 'Invalid value.' }] : [];
              })
            : [];
          if (issues.length === 0)
            throw new ProblemException({ status: 503, code: 'upstream.failed' });
          throw new ProblemException({ status: 400, code, details: { issues } });
        }
        if (status === 404 && code === 'organization.not-found') {
          throw new ProblemException({ status: 404, code });
        }
        if (
          status === 403 &&
          [
            'auth.issuer-not-allowed',
            'auth.actor-not-allowed',
            'auth.organization-required',
          ].includes(code)
        ) {
          throw new ProblemException({ status: 503, code: 'upstream.unauthorized' });
        }
        if (status === 503) {
          const allowed = [
            'search.unavailable',
            'upstream.failed',
            'upstream.unauthorized',
            'upstream.unreachable',
            'upstream.timeout',
            'upstream.unavailable',
            'upstream.circuit-open',
            'upstream.deadline-exceeded',
          ];
          throw new ProblemException({
            status: 503,
            code: allowed.includes(code) ? code : 'upstream.failed',
          });
        }
        throw new ProblemException({ status: 503, code: 'upstream.failed' });
      }
    },
  };
}
