import type { ProblemException } from '@cadenway/nest-common';

import { publicProblem } from './public-problem.js';

/**
 * Function sessionRequiredProblem
 *
 * @description
 * `401 auth.session-required`: the request carries no session cookie. The web application sends
 * the person to the sign-in screen on it.
 *
 * @returns {ProblemException} The problem to throw.
 */
export function sessionRequiredProblem(): ProblemException {
  return publicProblem({
    status: 401,
    code: 'auth.session-required',
    detail: 'This request needs a session.',
  });
}

/**
 * Function sessionExpiredProblem
 *
 * @description
 * `401 auth.session-expired`: the cookie names a session that ended (expired, revoked or unknown),
 * or whose account can no longer be read. The web application signs the person in again.
 *
 * @param {unknown} cause - The internal problem that showed the session ended, kept for the log
 * line of the request; none when the introspection itself said so.
 * @returns {ProblemException} The problem to throw.
 */
export function sessionExpiredProblem(cause?: unknown): ProblemException {
  return publicProblem({
    status: 401,
    code: 'auth.session-expired',
    detail: 'The session of this request has ended.',
    ...(cause === undefined ? {} : { cause }),
  });
}
