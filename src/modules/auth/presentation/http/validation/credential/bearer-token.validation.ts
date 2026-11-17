import { createApiTokenResponseSecretRegExp } from '@cadenway/contracts/validators/public/api-tokens';
import type { Request } from 'express';

/**
 * Type BearerToken
 *
 * @description
 * What the `Authorization` header of a request holds: no bearer token (no header, or another
 * scheme), a bearer token that cannot be a personal API token, or a candidate token to
 * introspect.
 *
 * @type {{ readonly kind: 'absent' } | { readonly kind: 'malformed' } | { readonly kind: 'token'; readonly token: string }}
 */
export type BearerToken =
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'token'; readonly token: string };

/**
 * Constant BEARER_AUTHORIZATION
 *
 * @description
 * `Authorization: Bearer <token>`, the scheme compared without regard to case (RFC 9110). The
 * token is everything after the spaces that follow the scheme.
 *
 * @type {RegExp}
 */
const BEARER_AUTHORIZATION: RegExp = /^Bearer(?:\s+(.*))?$/iu;

/**
 * Function readBearerToken
 *
 * @description
 * Reads the bearer token of a request. A token that does not have the format of a personal API
 * token (`cw_pat_` and 36 base62 characters, the `secret` pattern of
 * `openapi/public/api-tokens.yaml`) cannot be active and is reported as malformed, so it is
 * refused without a call to identity-service. Another scheme (`Basic`, ...) carries no bearer
 * token and leaves the request to its session cookie.
 *
 * @param {Request} request - Incoming request.
 * @returns {BearerToken} What the header holds. The token is a secret, never logged.
 */
export function readBearerToken(request: Request): BearerToken {
  const header: string | undefined = request.get('Authorization');
  const match: RegExpExecArray | null =
    header === undefined ? null : BEARER_AUTHORIZATION.exec(header.trim());
  if (match === null) {
    return { kind: 'absent' };
  }
  const token: string = (match[1] ?? '').trim();
  return createApiTokenResponseSecretRegExp.test(token)
    ? { kind: 'token', token }
    : { kind: 'malformed' };
}
