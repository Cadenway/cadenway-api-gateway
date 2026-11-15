import { ProblemException } from '@cadenway/nest-common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { assertSameSiteRequest, isUnsafeMethod } from './cross-site.js';

/**
 * Constant ALLOWED
 *
 * @description
 * Allowed origins of the tests.
 *
 * @type {readonly string[]}
 */
const ALLOWED: readonly string[] = ['https://app.cadenway.test', 'https://cadenway.test'];

/**
 * Function requestWith
 *
 * @description
 * A request with the given headers, read as Express reads them (case-insensitive).
 *
 * @param {Record<string, string>} headers - Request headers.
 * @returns {Request} The request.
 */
function requestWith(headers: Record<string, string>): Request {
  const lower: Map<string, string> = new Map<string, string>(
    Object.entries(headers).map(([name, value]: [string, string]) => [name.toLowerCase(), value]),
  );
  return { get: (name: string) => lower.get(name.toLowerCase()) } as unknown as Request;
}

describe('isUnsafeMethod', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'PROPFIND'])(
    'treats %s as unsafe',
    (method) => {
      expect(isUnsafeMethod(method)).toBe(true);
    },
  );

  it.each(['GET', 'HEAD', 'OPTIONS'])('treats %s as safe', (method) => {
    expect(isUnsafeMethod(method)).toBe(false);
  });
});

describe('assertSameSiteRequest', () => {
  it.each(['application/json', 'application/json; charset=utf-8', 'Application/JSON'])(
    'accepts an allowed origin with Content-Type %s',
    (contentType) => {
      expect(() => {
        assertSameSiteRequest(
          requestWith({ Origin: 'https://app.cadenway.test', 'Content-Type': contentType }),
          ALLOWED,
        );
      }).not.toThrow();
    },
  );

  it.each([
    [{ 'Content-Type': 'application/json' }],
    [{ Origin: 'https://APP.cadenway.test', 'Content-Type': 'application/json' }],
    [
      {
        Origin: 'https://app.cadenway.test, https://evil.test',
        'Content-Type': 'application/json',
      },
    ],
    [{ Origin: 'https://app.cadenway.test' }],
    [{ Origin: 'https://app.cadenway.test', 'Content-Type': 'application/json-patch+json' }],
    [{ Origin: 'https://app.cadenway.test', 'Content-Type': 'text/plain;application/json' }],
  ])('refuses %j with 403 auth.csrf-rejected', (headers) => {
    let thrown: unknown;
    try {
      assertSameSiteRequest(requestWith(headers), ALLOWED);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ProblemException);
    expect((thrown as ProblemException).problem).toMatchObject({
      status: 403,
      code: 'auth.csrf-rejected',
      title: 'Forbidden',
    });
  });
});
