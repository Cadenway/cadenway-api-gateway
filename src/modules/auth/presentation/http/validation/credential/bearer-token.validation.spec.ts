import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { readBearerToken } from './bearer-token.validation.js';

/**
 * Constant SECRET
 *
 * @description
 * A secret in the format of a personal API token.
 *
 * @type {string}
 */
const SECRET: string = 'cw_pat_ExampleOnlyNotARealToken000000000000';

/**
 * Function requestWith
 *
 * @description
 * A request with the given `Authorization` header, read as Express reads it.
 *
 * @param {string | undefined} authorization - The header, or none.
 * @returns {Request} The request.
 */
function requestWith(authorization: string | undefined): Request {
  return {
    get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  } as unknown as Request;
}

describe('readBearerToken', () => {
  it('reads no bearer token without an Authorization header', () => {
    expect(readBearerToken(requestWith(undefined))).toEqual({ kind: 'absent' });
  });

  it('leaves another scheme to the session cookie', () => {
    expect(readBearerToken(requestWith('Basic dXNlcjpwYXNz'))).toEqual({ kind: 'absent' });
  });

  it.each([`Bearer ${SECRET}`, `bearer ${SECRET}`, `BEARER   ${SECRET}`])(
    'reads a personal API token from %s',
    (header) => {
      expect(readBearerToken(requestWith(header))).toEqual({ kind: 'token', token: SECRET });
    },
  );

  it.each([
    ['without a token', 'Bearer'],
    ['with a session token', 'Bearer f4Kx9-session-token-of-camille'],
    ['with a short secret', 'Bearer cw_pat_short'],
    ['with characters outside base62', `Bearer ${SECRET.slice(0, -1)}-`],
    ['with two tokens', `Bearer ${SECRET} ${SECRET}`],
  ])('reports a bearer token %s as malformed', (_label, header) => {
    expect(readBearerToken(requestWith(header))).toEqual({ kind: 'malformed' });
  });
});
