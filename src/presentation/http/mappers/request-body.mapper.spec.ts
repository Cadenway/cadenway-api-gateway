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
      toRequiredBody(
        {
          headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
          body: {},
          readableDidRead: true,
        },
        EMPTY_REQUEST,
      ),
    ).toEqual({});
  });

  it('refuses chunked JSON that delivered no bytes before the parser returned {}', () => {
    const problem = problemOf(() =>
      toRequiredBody(
        {
          headers: { 'content-type': 'application/json', 'transfer-encoding': 'Chunked' },
          body: {},
          readableDidRead: false,
        },
        EMPTY_REQUEST,
      ),
    );

    expect(problem).toMatchObject({
      status: 400,
      code: 'request.invalid',
      details: {
        issues: [{ in: 'body', path: '', code: 'required', message: 'Expected a JSON body.' }],
      },
    });
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

  it.each([
    ['application/json; charset=UTF-8'],
    ['Application/JSON; Charset="utf-8"'],
    ['application/json; foo=bar'],
  ])('accepts a JSON body in UTF-8 sent as %s', (contentType: string) => {
    expect(
      toRequiredBody(
        { headers: { 'content-length': '2', 'content-type': contentType }, body: {} },
        EMPTY_REQUEST,
      ),
    ).toEqual({});
  });

  it.each([
    ['a form-encoded body', 'application/x-www-form-urlencoded'],
    ['a text body', 'text/plain'],
    ['JSON in UTF-16', 'application/json; charset=utf-16le'],
    ['JSON with a charset without a value', 'application/json; charset'],
    ['a JSON-like media type', 'application/problem+json'],
  ])(
    'refuses %s, which a parser may hand on as {}, before the validator',
    (_label: string, contentType: string) => {
      const problem = problemOf(() =>
        toRequiredBody(
          { headers: { 'content-length': '1', 'content-type': contentType }, body: {} },
          EMPTY_REQUEST,
        ),
      );

      expect(problem).toMatchObject({
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [
            {
              in: 'body',
              path: '',
              code: 'unsupported_media_type',
              message: 'Expected an application/json body in UTF-8.',
            },
          ],
        },
      });
    },
  );

  it('leaves a body without Content-Type to the validator, since no parser reads it', () => {
    const problem = problemOf(() =>
      toRequiredBody({ headers: { 'content-length': '2' } }, EMPTY_REQUEST),
    );

    expect(problem).toMatchObject({
      status: 400,
      code: 'request.invalid',
      details: { issues: [{ in: 'body', path: '', code: 'invalid_type' }] },
    });
  });

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
