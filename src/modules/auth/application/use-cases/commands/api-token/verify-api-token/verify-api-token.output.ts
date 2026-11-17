import type { VerifiedApiToken } from '../../../../models/api-token/verified-api-token.model.js';

/**
 * Type VerifyApiTokenOutput
 *
 * @description
 * The outcome of the verification of a bearer token:
 *
 * - `verified`: identity-service found the token active, `token` says for whom;
 * - `invalid`: the token is malformed, or identity-service did not find it active; the failure is
 *   counted;
 * - `throttled`: the client address used its failed authentications of the window, so the token
 *   was not checked; retry after `retryAfterSeconds`, whole seconds, at least 1.
 *
 * @type {{ readonly outcome: 'verified'; readonly token: VerifiedApiToken } | { readonly outcome: 'invalid' } | { readonly outcome: 'throttled'; readonly retryAfterSeconds: number }}
 */
export type VerifyApiTokenOutput =
  | { readonly outcome: 'verified'; readonly token: VerifiedApiToken }
  | { readonly outcome: 'invalid' }
  | { readonly outcome: 'throttled'; readonly retryAfterSeconds: number };
