import { ProblemException } from '@cadenway/nest-common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import {
  assertCookieRequestSameSite,
  assertSameSiteRequest,
  isUnsafeMethod,
} from './cross-site.validation.js';

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

describe('assertCookieRequestSameSite', () => {
  /**
   * A request with a method and headers, read as Express reads them.
   *
   * @param method - Method of the request.
   * @param headers - Request headers.
   * @returns The request.
   */
  function cookieRequest(method: string, headers: Record<string, string>): Request {
    return Object.assign(requestWith(headers), { method });
  }

  it.each<Record<string, string>>([
    { Origin: 'https://app.cadenway.test' },
    { Origin: 'https://app.cadenway.test', 'Content-Length': '0' },
  ])('accepts an opted-in empty POST carrying %j', (headers) => {
    expect(() => {
      assertCookieRequestSameSite(cookieRequest('POST', headers), ALLOWED, true);
    }).not.toThrow();
  });

  it.each<Record<string, string>>([
    { Origin: 'https://evil.test' },
    { Origin: 'https://app.cadenway.test', 'Content-Length': '1' },
    { Origin: 'https://app.cadenway.test', 'Transfer-Encoding': 'chunked' },
    { Origin: 'https://app.cadenway.test', 'Content-Type': 'text/plain' },
  ])('refuses an opted-in empty POST carrying %j', (headers) => {
    expect(() => {
      assertCookieRequestSameSite(cookieRequest('POST', headers), ALLOWED, true);
    }).toThrow(ProblemException);
  });

  it.each([
    [
      'a JSON body',
      'PATCH',
      {
        Origin: 'https://app.cadenway.test',
        'Content-Type': 'application/json',
        'Content-Length': '12',
      },
    ],
    ['a bodiless DELETE on its Origin alone', 'DELETE', { Origin: 'https://app.cadenway.test' }],
    [
      'a DELETE with an empty body on its Origin alone',
      'DELETE',
      { Origin: 'https://cadenway.test', 'Content-Length': '0' },
    ],
    [
      'a DELETE that declares JSON',
      'DELETE',
      { Origin: 'https://cadenway.test', 'Content-Type': 'application/json' },
    ],
  ])('accepts %s', (_label, method, headers) => {
    expect(() => {
      assertCookieRequestSameSite(cookieRequest(method, headers), ALLOWED);
    }).not.toThrow();
  });

  it.each([
    ['no Origin', 'POST', { 'Content-Type': 'application/json', 'Content-Length': '2' }],
    ['a DELETE without Origin', 'DELETE', {}],
    ['a DELETE from another Origin', 'DELETE', { Origin: 'https://evil.test' }],
    ['the null Origin', 'DELETE', { Origin: 'null' }],
    ['a bodiless POST without a media type', 'POST', { Origin: 'https://app.cadenway.test' }],
    ['a bodiless PATCH without a media type', 'PATCH', { Origin: 'https://app.cadenway.test' }],
    ['a bodiless PUT without a media type', 'PUT', { Origin: 'https://app.cadenway.test' }],
    [
      'a DELETE with a body without a media type',
      'DELETE',
      { Origin: 'https://app.cadenway.test', 'Content-Length': '9' },
    ],
    [
      'a DELETE with a chunked body without a media type',
      'DELETE',
      { Origin: 'https://app.cadenway.test', 'Transfer-Encoding': 'chunked' },
    ],
    [
      'a form body',
      'POST',
      {
        Origin: 'https://app.cadenway.test',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '3',
      },
    ],
    [
      'a DELETE that declares a text media type',
      'DELETE',
      { Origin: 'https://app.cadenway.test', 'Content-Type': 'text/plain' },
    ],
  ])('refuses %s with 403 auth.csrf-rejected', (_label, method, headers) => {
    let thrown: unknown;
    try {
      assertCookieRequestSameSite(cookieRequest(method, headers), ALLOWED);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ProblemException);
    expect((thrown as ProblemException).problem).toMatchObject({
      status: 403,
      code: 'auth.csrf-rejected',
    });
  });
});
