import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import {
  CLEARED_SESSION_COOKIE,
  readSessionCookie,
  sessionCookieHeader,
} from './session-cookie.js';

/**
 * Type SessionCookie
 *
 * @description
 * The parsed request cookie returned by the HTTP codec.
 *
 * @type {ReturnType<typeof readSessionCookie>}
 */
type SessionCookie = ReturnType<typeof readSessionCookie>;

/**
 * Function withCookies
 *
 * @description
 * A request as cookie-parser leaves it.
 *
 * @param {Record<string, unknown> | undefined} cookies - Parsed cookies.
 * @returns {Request} The request.
 */
function withCookies(cookies: Record<string, unknown> | undefined): Request {
  return { cookies } as unknown as Request;
}

describe('sessionCookieHeader', () => {
  const now: Date = new Date('2026-11-08T13:07:00Z');

  it('writes no Max-Age for a session that ends with the browser', () => {
    expect(
      sessionCookieHeader('abc', { expiresAt: '2026-11-09T01:07:00Z', persistent: false }, now),
    ).toBe('__Host-cw_session=abc; Path=/; Secure; HttpOnly; SameSite=Lax');
  });

  it('writes Max-Age in whole seconds, rounded down, for a persistent session', () => {
    expect(
      sessionCookieHeader('abc', { expiresAt: '2026-12-08T13:07:00.999Z', persistent: true }, now),
    ).toBe('__Host-cw_session=abc; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000');
  });

  it('percent-encodes a character that would end the cookie value', () => {
    expect(
      sessionCookieHeader('a;b c', { expiresAt: '2026-11-09T01:07:00Z', persistent: false }, now),
    ).toBe('__Host-cw_session=a%3Bb%20c; Path=/; Secure; HttpOnly; SameSite=Lax');
  });

  it('clears the cookie with the same attributes', () => {
    expect(CLEARED_SESSION_COOKIE).toBe(
      '__Host-cw_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    );
  });
});

describe('readSessionCookie', () => {
  it.each<[string, Record<string, unknown> | undefined, SessionCookie]>([
    ['no cookie-parser result', undefined, { kind: 'absent' }],
    ['no session cookie', { other: 'x' }, { kind: 'absent' }],
    ['an empty cookie', { __Host_cw_session: 'x', '__Host-cw_session': '' }, { kind: 'absent' }],
    ['a JSON cookie', { '__Host-cw_session': { a: 1 } }, { kind: 'malformed' }],
    ['a value too long', { '__Host-cw_session': 'x'.repeat(257) }, { kind: 'malformed' }],
    [
      'a token',
      { '__Host-cw_session': 'x'.repeat(256) },
      { kind: 'token', token: 'x'.repeat(256) },
    ],
  ])('reads %s', (_label, cookies, expected) => {
    expect(readSessionCookie(withCookies(cookies))).toEqual(expected);
  });
});
