import { introspectTokenBodyTokenMax } from '@cadenway/contracts/validators/internal/identity-service';
import type { Request } from 'express';

/**
 * Constant SESSION_COOKIE_NAME
 *
 * @description
 * Name of the cookie that carries the opaque session token. The `__Host-` prefix makes the browser
 * refuse it unless it is `Secure`, has `Path=/` and no `Domain`: it is sent back to the API host
 * only.
 *
 * @type {string}
 */
export const SESSION_COOKIE_NAME: string = '__Host-cw_session';

/**
 * Constant MAX_SESSION_TOKEN_LENGTH
 *
 * @description
 * Longest token the introspection accepts (`IntrospectionRequest.token` of the internal contract).
 * A longer cookie cannot be a session token and is treated as an unknown one, without a call.
 *
 * @type {number}
 */
export const MAX_SESSION_TOKEN_LENGTH: number = introspectTokenBodyTokenMax;

/**
 * Constant SESSION_COOKIE_ATTRIBUTES
 *
 * @description
 * Attributes of the session cookie, in the order `openapi/public/auth.yaml` documents them: sent to
 * every path of the API, over HTTPS only, never readable by scripts, and not sent on cross-site
 * subrequests or form posts.
 *
 * @type {string}
 */
const SESSION_COOKIE_ATTRIBUTES: string = 'Path=/; Secure; HttpOnly; SameSite=Lax';

/**
 * Constant CLEARED_SESSION_COOKIE
 *
 * @description
 * `Set-Cookie` value of the sign-out: an empty value that the browser deletes at once
 * (`Max-Age=0`), with the attributes of the cookie it replaces.
 *
 * @type {string}
 */
export const CLEARED_SESSION_COOKIE: string = `${SESSION_COOKIE_NAME}=; ${SESSION_COOKIE_ATTRIBUTES}; Max-Age=0`;

/**
 * Interface IssuedSession
 *
 * @description
 * The part of an issued session the cookie is built from (`Session` of the internal contract).
 */
export interface IssuedSession {
  // #region Properties
  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest, as an ISO 8601 instant.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property persistent
   *
   * @description
   * `true` when the person asked to stay signed in ("Rester connecté pendant 30 jours"): the
   * cookie then lasts until `expiresAt`, else until the browser closes.
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;
  // #endregion
}

/**
 * Type SessionCookie
 *
 * @description
 * What a request carries in the session cookie: nothing (no cookie, or an empty one), a value that
 * cannot be a session token (not text, or longer than `MAX_SESSION_TOKEN_LENGTH`), or a candidate
 * token to introspect.
 *
 * @type {{ readonly kind: 'absent' } | { readonly kind: 'malformed' } | { readonly kind: 'token'; readonly token: string }}
 */
export type SessionCookie =
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'token'; readonly token: string };

/**
 * Function sessionCookieHeader
 *
 * @description
 * Builds the `Set-Cookie` value of a route that signs in, exactly as `openapi/public/auth.yaml`
 * documents it: `__Host-cw_session=<token>; Path=/; Secure; HttpOnly; SameSite=Lax`, plus
 * `Max-Age=<seconds until expiresAt>` for a persistent session only. Without `Max-Age` the cookie
 * ends with the browser. No `Expires` is written: `Max-Age` does not depend on the browser's
 * clock. The token is percent-encoded so that no character can end the cookie value; cookie-parser
 * decodes it on the way back.
 *
 * @param {string} token - Opaque session token returned once by identity-service. A secret: the
 * value built here is never logged.
 * @param {IssuedSession} session - Expiry and persistence of the session.
 * @param {Date} now - Current time.
 * @returns {string} The `Set-Cookie` header value.
 */
export function sessionCookieHeader(token: string, session: IssuedSession, now: Date): string {
  const cookie: string = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${SESSION_COOKIE_ATTRIBUTES}`;
  if (!session.persistent) {
    return cookie;
  }
  // Rounded down, so that the cookie never outlives the session.
  const maxAge: number = Math.max(
    0,
    Math.floor((Date.parse(session.expiresAt) - now.getTime()) / 1000),
  );
  return `${cookie}; Max-Age=${String(maxAge)}`;
}

/**
 * Function readSessionCookie
 *
 * @description
 * Reads the session cookie of a request, as cookie-parser parsed it. cookie-parser turns a value
 * that starts with `j:` into an object: such a value is not a token.
 *
 * @param {Request} request - Incoming request, after cookie-parser.
 * @returns {SessionCookie} What the cookie holds.
 */
export function readSessionCookie(request: Request): SessionCookie {
  const cookies: Readonly<Record<string, unknown>> | undefined = request.cookies as
    Readonly<Record<string, unknown>> | undefined;
  const value: unknown = cookies?.[SESSION_COOKIE_NAME];
  if (value === undefined || value === '') {
    return { kind: 'absent' };
  }
  if (typeof value !== 'string' || value.length > MAX_SESSION_TOKEN_LENGTH) {
    return { kind: 'malformed' };
  }
  return { kind: 'token', token: value };
}
