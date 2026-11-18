import type { ProblemException } from '@cadenway/nest-common';

import { publicProblem } from './public-problem.js';

/**
 * Function apiTokenInvalidProblem
 *
 * @description
 * `401 auth.api-token-invalid`: the bearer token is unknown, revoked, expired or malformed, or
 * its user no longer belongs to its organization.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function apiTokenInvalidProblem(): ProblemException {
  return publicProblem({
    status: 401,
    code: 'auth.api-token-invalid',
    detail: 'The personal API token of this request is not valid.',
  });
}

/**
 * Function apiTokenNotAcceptedProblem
 *
 * @description
 * `403 auth.api-token-not-accepted`: the operation lists the session cookie only in its
 * `security`, and the request is authenticated by a personal API token.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function apiTokenNotAcceptedProblem(): ProblemException {
  return publicProblem({
    status: 403,
    code: 'auth.api-token-not-accepted',
    detail: 'This route does not accept a personal API token.',
  });
}

/**
 * Function scopeMissingProblem
 *
 * @description
 * `403 auth.scope-missing`: the personal API token lacks a scope its operation requires;
 * `details.requiredScopes` lists them all.
 *
 * @param {readonly string[]} requiredScopes - Scopes the operation requires of a token.
 * @returns {ProblemException} The problem to throw.
 */
export function scopeMissingProblem(requiredScopes: readonly string[]): ProblemException {
  return publicProblem({
    status: 403,
    code: 'auth.scope-missing',
    detail: 'The personal API token lacks a scope this route requires.',
    details: { requiredScopes: [...requiredScopes] },
  });
}

/**
 * Function organizationNotSelectedProblem
 *
 * @description
 * `403 organization.not-selected`: the operation acts on the current organization and the session
 * has none; the web application shows the picker.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function organizationNotSelectedProblem(): ProblemException {
  return publicProblem({
    status: 403,
    code: 'organization.not-selected',
    detail: 'This route acts on the current organization, and the session has none.',
  });
}

/**
 * Constant WITHHELD_ORGANIZATION_CODES
 *
 * @description
 * The codes of `withheldOrganization` the public contracts declare, which the gateway answers as
 * they are: `organization.mfa-required` today. identity-service may add codes
 * (`x-extensible-enum`); until the public contracts declare one, the gateway refuses the request
 * as a gateway that does not read `withheldOrganization` would, never with an undeclared code.
 *
 * @type {ReadonlySet<string>}
 */
const WITHHELD_ORGANIZATION_CODES: ReadonlySet<string> = new Set<string>([
  'organization.mfa-required',
]);

/**
 * Function organizationWithheldProblem
 *
 * @description
 * `403 organization.mfa-required` (the `code` identity-service names in `withheldOrganization`):
 * the authentication policy of the organization the credential acts on requires two-step
 * verification for the role of its person, who has none, so the organization is withheld and the
 * route, which needs it, is refused. `details.organizationId` names it, so that the web
 * application offers the setup from the account.
 *
 * @param {{ readonly organizationId: string; readonly code: string }} withheld - The
 * `withheldOrganization` of the introspection.
 * @returns {ProblemException | undefined} The problem to throw, or `undefined` for a code the
 * public contracts do not declare: the caller then refuses the request with the problem a gateway
 * that ignores `withheldOrganization` would answer.
 */
export function organizationWithheldProblem(withheld: {
  readonly organizationId: string;
  readonly code: string;
}): ProblemException | undefined {
  if (!WITHHELD_ORGANIZATION_CODES.has(withheld.code)) {
    return undefined;
  }
  return publicProblem({
    status: 403,
    code: withheld.code,
    detail: 'The organization of this request requires two-step verification of the caller.',
    details: { organizationId: withheld.organizationId },
  });
}

/**
 * Function rateLimitExceededProblem
 *
 * @description
 * `429 rate-limit.exceeded`: the session or personal API token of the request used its requests
 * of the current window. The caller sets `Retry-After`.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function rateLimitExceededProblem(): ProblemException {
  return publicProblem({
    status: 429,
    code: 'rate-limit.exceeded',
    detail: 'Too many requests for this credential; retry after the delay of Retry-After.',
  });
}

/**
 * Function anonymousRateLimitExceededProblem
 *
 * @description
 * `429 rate-limit.exceeded`: the client address of a request without a credential used its
 * requests of the current window. The caller sets `Retry-After`.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function anonymousRateLimitExceededProblem(): ProblemException {
  return publicProblem({
    status: 429,
    code: 'rate-limit.exceeded',
    detail: 'Too many requests from this client; retry after the delay of Retry-After.',
  });
}

/**
 * Function bearerFailureLimitExceededProblem
 *
 * @description
 * `429 rate-limit.exceeded`: the client address of a request with a bearer token used its failed
 * bearer-token authentications of the current window, so the token is not checked. The caller sets
 * `Retry-After`.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function bearerFailureLimitExceededProblem(): ProblemException {
  return publicProblem({
    status: 429,
    code: 'rate-limit.exceeded',
    detail:
      'Too many failed personal API token authentications from this client; retry after the delay of Retry-After.',
  });
}
