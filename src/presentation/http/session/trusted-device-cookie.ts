import { signInWithPasswordInternalBodyTrustedDeviceTokenMax } from '@cadenway/contracts/validators/internal/identity-service';
import type { Request } from 'express';

/**
 * Constant TRUSTED_DEVICE_COOKIE_NAME
 *
 * @description
 * Name of the cookie that carries the opaque token of a trusted device (`openapi/public/auth.yaml`,
 * "Trusted devices"). The `__Host-` prefix makes the browser refuse it unless it is `Secure`, has
 * `Path=/` and no `Domain`.
 *
 * @type {string}
 */
export const TRUSTED_DEVICE_COOKIE_NAME: string = '__Host-cw_trusted_device';

/**
 * Constant MAX_TRUSTED_DEVICE_TOKEN_LENGTH
 *
 * @description
 * Longest token the internal sign-ins accept in `trustedDeviceToken`. A longer cookie cannot be a
 * device token and is left out, as the internal contract asks.
 *
 * @type {number}
 */
const MAX_TRUSTED_DEVICE_TOKEN_LENGTH: number = signInWithPasswordInternalBodyTrustedDeviceTokenMax;

/**
 * Constant TRUSTED_DEVICE_COOKIE_ATTRIBUTES
 *
 * @description
 * Attributes of the device cookie, exactly as `SetSessionAndTrustedDeviceCookies` of the public
 * contract writes them: every path of the API, HTTPS only, never readable by scripts, never sent
 * by another site, for 30 days (2,592,000 seconds), whatever the clock of the browser.
 *
 * @type {string}
 */
const TRUSTED_DEVICE_COOKIE_ATTRIBUTES: string =
  'Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000';

/**
 * Function trustedDeviceCookieHeader
 *
 * @description
 * Builds the `Set-Cookie` value of the device cookie of an answer of a two-step challenge with
 * `trustDevice`: `__Host-cw_trusted_device=<token>; Path=/; Secure; HttpOnly; SameSite=Strict;
 * Max-Age=2592000`. The token is percent-encoded so that no character can end the cookie value;
 * cookie-parser decodes it on the way back. A browser trusts one account at a time: the new cookie
 * replaces any previous one.
 *
 * @param {string} token - Opaque device token returned once by identity-service. A secret: the
 * value built here is never logged and never put in a body.
 * @returns {string} The `Set-Cookie` header value.
 */
export function trustedDeviceCookieHeader(token: string): string {
  return `${TRUSTED_DEVICE_COOKIE_NAME}=${encodeURIComponent(token)}; ${TRUSTED_DEVICE_COOKIE_ATTRIBUTES}`;
}

/**
 * Function readTrustedDeviceToken
 *
 * @description
 * Reads the device cookie of a request, as cookie-parser parsed it, for the two sign-ins only
 * (`trustedDeviceToken` of the internal sign-ins). A value that is not text (cookie-parser turns
 * `j:` values into objects), empty, or longer than the internal contract allows is left out: the
 * sign-in then answers its challenge, as for an unknown token.
 *
 * @param {Request} request - Incoming request, after cookie-parser.
 * @returns {string | undefined} The candidate device token, or `undefined`. A secret, never
 * logged.
 */
export function readTrustedDeviceToken(request: Request): string | undefined {
  const cookies: Readonly<Record<string, unknown>> | undefined = request.cookies as
    Readonly<Record<string, unknown>> | undefined;
  const value: unknown = cookies?.[TRUSTED_DEVICE_COOKIE_NAME];
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_TRUSTED_DEVICE_TOKEN_LENGTH
  ) {
    return undefined;
  }
  return value;
}
