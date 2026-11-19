import { ProblemException, type Problem } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toRequiredBody } from './request-body.mapper.js';

/**
 * A body with no member, as `EmptyRequest` declares it.
 */
const EMPTY_REQUEST = z.object({}).strict();

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

describe('toRequiredBody', () => {
  it('accepts a literal {} sent with its length', () => {
    expect(toRequiredBody({ headers: { 'content-length': '2' }, body: {} }, EMPTY_REQUEST)).toEqual(
      {},
    );
  });

  it('accepts a chunked body, which declares no length', () => {
    expect(
      toRequiredBody({ headers: { 'transfer-encoding': 'chunked' }, body: {} }, EMPTY_REQUEST),
    ).toEqual({});
  });

  it.each([
    ['Content-Length: 0', '0'],
    ['Content-Length: 00', '00'],
  ])(
    'refuses a zero-byte body (%s), which the JSON parser hands on as {}',
    (_label: string, length: string) => {
      const problem = problemOf(() =>
        toRequiredBody({ headers: { 'content-length': length }, body: {} }, EMPTY_REQUEST),
      );

      expect(problem).toMatchObject({
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [{ in: 'body', path: '', code: 'required', message: 'Expected a JSON body.' }],
        },
      });
    },
  );

  it('leaves a request with no body at all to the validator, located in the body', () => {
    const problem = problemOf(() => toRequiredBody({ headers: {} }, EMPTY_REQUEST));

    expect(problem).toMatchObject({
      status: 400,
      code: 'request.invalid',
      details: { issues: [{ in: 'body', path: '', code: 'invalid_type' }] },
    });
  });

  it('answers a body outside its contract as the validator of the body does', () => {
    const problem = problemOf(() =>
      toRequiredBody({ headers: { 'content-length': '11' }, body: { extra: 1 } }, EMPTY_REQUEST),
    );

    expect(problem).toMatchObject({
      status: 400,
      code: 'request.invalid',
      details: { issues: [{ in: 'body', code: 'unrecognized_keys' }] },
    });
  });
});
