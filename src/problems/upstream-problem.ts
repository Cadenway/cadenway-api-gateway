import { ProblemException, type Problem, type ProblemStatus } from '@cadenway/nest-common';
import type { Response } from 'express';

import { isProblemStatus, publicProblem } from './public-problem.js';
import { sessionExpiredProblem } from './session-problems.js';

/**
 * Type AcceptedProblems
 *
 * @description
 * The client errors of an internal call that a public route answers as they are, by status: the
 * `code`s its public operation declares for that status. Any other client error of the call is a
 * defect of the called service and answers `503 upstream.failed`.
 *
 * @type {Readonly<Partial<Record<ProblemStatus, readonly string[]>>>}
 */
export type AcceptedProblems = Readonly<Partial<Record<ProblemStatus, readonly string[]>>>;

/**
 * Constant INTERNAL_ACCESS_CODES
 *
 * @description
 * Refusals of the internal token by the guard of the called service: the route does not accept
 * the issuer, the actor or the missing organization of the token. They are configuration defects
 * of the gateway, never something the browser did, so they answer `503 upstream.unauthorized`, as
 * a `401` of the internal token does in the internal HTTP client.
 *
 * @type {ReadonlySet<string>}
 */
const INTERNAL_ACCESS_CODES: ReadonlySet<string> = new Set<string>([
  'auth.issuer-not-allowed',
  'auth.actor-not-allowed',
  'auth.organization-required',
]);

/**
 * Constant RETRY_AFTER_DETAILS
 *
 * @description
 * Members of `details` that say when a refused request can succeed, in the order they are read:
 * `lockedUntil` of `auth.account-locked`, `resendAvailableAt` of `auth.code-throttled`,
 * `auth.reset-throttled` and `invitation.resend-throttled`, and `nextAvailableAt` of
 * `invitation.daily-limit-reached`. The
 * internal HTTP client does not carry the headers of a problem, so `Retry-After` is derived from
 * them.
 *
 * @type {readonly string[]}
 */
const RETRY_AFTER_DETAILS: readonly string[] = [
  'lockedUntil',
  'resendAvailableAt',
  'nextAvailableAt',
];

/**
 * Function upstreamProblem
 *
 * @description
 * Builds a `503 upstream.<reason>` problem naming the called service, as the internal HTTP client
 * of `@cadenway/nest-common` does.
 *
 * @param {'failed' | 'unauthorized'} reason - Last part of the code.
 * @param {unknown} service - `details.service` of the internal problem: the called service.
 * @param {unknown} cause - Internal problem, kept for the log line of the request.
 * @returns {ProblemException} The problem to throw.
 */
function upstreamProblem(
  reason: 'failed' | 'unauthorized',
  service: unknown,
  cause: unknown,
): ProblemException {
  return publicProblem({
    status: 503,
    code: `upstream.${reason}`,
    detail: 'A service this request depends on is not available.',
    ...(typeof service === 'string' ? { details: { service } } : {}),
    cause,
  });
}

/**
 * Function isUpstreamProblem
 *
 * @description
 * Recognizes one client error of an internal call, before it is translated: a route that gives a
 * code a meaning of its own (an already-ended session on the sign-out, an account that cannot be
 * read any more on `GET /v1/me`) checks it first.
 *
 * @param {unknown} error - What the internal client threw.
 * @param {ProblemStatus} status - Expected status.
 * @param {string} code - Expected code.
 * @returns {boolean} `true` when the error is that problem.
 */
export function isUpstreamProblem(error: unknown, status: ProblemStatus, code: string): boolean {
  return (
    error instanceof ProblemException &&
    error.problem.status === status &&
    error.problem.code === code
  );
}

/**
 * Function toPublicProblem
 *
 * @description
 * Translates the failure of an internal call into what the public route answers. An internal
 * problem document is never forwarded: only its `code` and its `details` are, under the French
 * title the gateway owns (`publicProblem`), and only for a status and code the public operation
 * declares (`accepted`).
 *
 * | Failure of the internal call                    | Public answer                             |
 * | ----------------------------------------------- | ----------------------------------------- |
 * | `503 upstream.*` of the internal HTTP client    | The same problem                          |
 * | `403` refusing the issuer, actor or organization | `503 upstream.unauthorized`               |
 * | A status and code listed in `accepted`          | Same, `details` without `service`         |
 * | Any other client error (internal `404` too)     | `503 upstream.failed`                     |
 * | Anything that is not a problem                  | Unchanged: the error filter answers `500` |
 *
 * An internal `404` is never answered as a `403` or with internal wording: a route that may answer
 * `404` lists the code in `accepted`, and gets a public `404` that says nothing about another
 * tenant's data.
 *
 * `aliases` renames an internal code the public operation does not declare to the code it
 * declares for the same status: an internal `404 organization.not-found` on a member route (the
 * caller left the organization) is the public `404 member.not-found` of that route.
 *
 * @param {unknown} error - What the internal client threw.
 * @param {AcceptedProblems} accepted - Client errors the public operation declares.
 * @param {Readonly<Record<string, string>>} aliases - Public code of an internal code, by code.
 * @returns {unknown} The error to throw.
 */
export function toPublicProblem(
  error: unknown,
  accepted: AcceptedProblems,
  aliases: Readonly<Record<string, string>> = {},
): unknown {
  if (!(error instanceof ProblemException)) {
    return error;
  }
  const { status, code: internalCode, details }: Problem = error.problem;
  const { service, ...members }: Readonly<Record<string, unknown>> = details ?? {};
  if (status === 503) {
    return error;
  }
  if (status === 403 && INTERNAL_ACCESS_CODES.has(internalCode)) {
    return upstreamProblem('unauthorized', service, error);
  }
  const code: string = aliases[internalCode] ?? internalCode;
  if (isProblemStatus(status) && accepted[status]?.includes(code) === true) {
    return publicProblem({
      status,
      code,
      ...(Object.keys(members).length === 0 ? {} : { details: members }),
      cause: error,
    });
  }
  return upstreamProblem('failed', service, error);
}

/**
 * Function retryAfterSeconds
 *
 * @description
 * Derives `Retry-After` from a `429` problem: the whole seconds left until `details.lockedUntil`,
 * `details.resendAvailableAt` or `details.nextAvailableAt`, rounded up and at least 1, as RFC 9110
 * and the contract require.
 *
 * @param {Problem} problem - Public problem about to be answered.
 * @param {Date} now - Current time.
 * @returns {number | undefined} The seconds to wait, or `undefined` for another status or when
 * `details` names no valid instant.
 */
export function retryAfterSeconds(problem: Problem, now: Date): number | undefined {
  if (problem.status !== 429) {
    return undefined;
  }
  for (const member of RETRY_AFTER_DETAILS) {
    const value: unknown = problem.details?.[member];
    const instant: number = typeof value === 'string' ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(instant)) {
      return Math.max(1, Math.ceil((instant - now.getTime()) / 1000));
    }
  }
  return undefined;
}

/**
 * Function relayUpstream
 *
 * @description
 * Runs the internal call of a public route and, when it fails, throws the public problem of
 * `toPublicProblem`, with `Retry-After` set on the response for a `429` (the error filter of
 * `@cadenway/nest-common` writes the body and keeps the headers already set).
 *
 * @param {Response} response - Response of the public request.
 * @param {AcceptedProblems} accepted - Client errors the public operation declares.
 * @param {() => Promise<TResult>} call - The internal call.
 * @param {Readonly<Record<string, string>>} aliases - Public code of an internal code, as for
 * `toPublicProblem`; none when omitted.
 * @returns {Promise<TResult>} What the call resolved with.
 * @throws {unknown} The public problem, or an error that is not a problem, unchanged.
 */
export async function relayUpstream<TResult>(
  response: Response,
  accepted: AcceptedProblems,
  call: () => Promise<TResult>,
  aliases: Readonly<Record<string, string>> = {},
): Promise<TResult> {
  try {
    return await call();
  } catch (error) {
    throw withRetryAfter(response, toPublicProblem(error, accepted, aliases));
  }
}

/**
 * Function relaySessionUpstream
 *
 * @description
 * Runs the internal call of a route about the session of the request or its account, as
 * `relayUpstream` does, with one more translation: a `404` whose code is in `endedSession`
 * (`session.not-found` when the session named by the introspection is no longer an open session
 * of the user, `user.not-found` when its account can no longer be read) means that the session
 * ended after its introspection, and answers `401 auth.session-expired`. The web application then
 * signs the person in again; the public operations declare no such `404`.
 *
 * @param {Response} response - Response of the public request.
 * @param {AcceptedProblems} accepted - Client errors the public operation declares.
 * @param {() => Promise<TResult>} call - The internal call.
 * @param {readonly string[]} endedSession - Codes of the internal `404` that end the session.
 * @returns {Promise<TResult>} What the call resolved with.
 * @throws {unknown} `401 auth.session-expired`, the public problem of `toPublicProblem`, or an
 * error that is not a problem, unchanged.
 */
export async function relaySessionUpstream<TResult>(
  response: Response,
  accepted: AcceptedProblems,
  call: () => Promise<TResult>,
  endedSession: readonly string[],
): Promise<TResult> {
  try {
    return await call();
  } catch (error) {
    if (endedSession.some((code: string) => isUpstreamProblem(error, 404, code))) {
      throw sessionExpiredProblem(error);
    }
    throw withRetryAfter(response, toPublicProblem(error, accepted));
  }
}

/**
 * Function withRetryAfter
 *
 * @description
 * Sets `Retry-After` on the response for a translated `429` problem (see `retryAfterSeconds`): the
 * error filter of `@cadenway/nest-common` writes the body and keeps the headers already set.
 *
 * @param {Response} response - Response of the public request.
 * @param {unknown} translated - What the route is about to throw.
 * @returns {unknown} The same error.
 */
function withRetryAfter(response: Response, translated: unknown): unknown {
  if (translated instanceof ProblemException) {
    const seconds: number | undefined = retryAfterSeconds(translated.problem, new Date());
    if (seconds !== undefined) {
      response.setHeader('Retry-After', String(seconds));
    }
  }
  return translated;
}
