import { ProblemException, type Problem } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { toIfMatchHeader } from './request-headers.mapper.js';

/**
 * Reads the problem a call throws.
 *
 * @param read - The call.
 * @returns The body of the problem.
 */
function problemOf(read: () => unknown): Problem {
  try {
    read();
  } catch (error: unknown) {
    if (error instanceof ProblemException) {
      return error.problem;
    }
    throw error;
  }
  throw new Error('Expected a problem.');
}

describe('toIfMatchHeader', () => {
  it('leaves an absent If-Match absent, for an unconditional write', () => {
    expect(toIfMatchHeader(undefined)).toBeUndefined();
  });

  it('returns a valid If-Match unchanged, quotes included', () => {
    expect(toIfMatchHeader('"4"')).toBe('"4"');
  });

  it('returns a value without quotes unchanged too, leaving its format to the owning service', () => {
    expect(toIfMatchHeader('4')).toBe('4');
  });

  it.each([
    ['a list of entity tags', '"4", "5"'],
    ['a weak entity tag', 'W/"7"'],
    ['the wildcard', '*'],
  ])('returns %s unchanged', (_label: string, value: string) => {
    expect(toIfMatchHeader(value)).toBe(value);
  });

  it.each([
    ['an empty value', ''],
    ['spaces only', '   '],
    ['a tab only', '\t'],
    ['spaces and tabs', ' \t '],
    ['a no-break space', '\u00a0'],
    ['a comma only', ','],
    ['two empty list members', ', '],
    ['empty list members around white space', ' , '],
  ])(
    'refuses %s with 400 request.invalid located in the header',
    (_label: string, value: string) => {
      const problem = problemOf(() => toIfMatchHeader(value));

      expect(problem).toMatchObject({
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [
            {
              in: 'header',
              path: 'If-Match',
              code: 'custom',
              message: 'Expected an entity tag, not a blank value.',
            },
          ],
        },
      });
    },
  );
});
