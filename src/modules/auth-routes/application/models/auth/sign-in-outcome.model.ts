import type { SessionIssued } from './session-issued.model.js';
import type { SignInChallenge } from './sign-in-challenge.model.js';

/**
 * Type SignInOutcome
 *
 * @description
 * What a sign-in by password or by email code leads to: a session opened (`signed-in`), or, for
 * an account with two-step verification on a device it does not trust, a two-step challenge to
 * answer, with no session and no token (`challenge`).
 *
 * @type {{ readonly outcome: 'signed-in'; readonly session: SessionIssued } | { readonly outcome: 'challenge'; readonly challenge: SignInChallenge }}
 */
export type SignInOutcome =
  | { readonly outcome: 'signed-in'; readonly session: SessionIssued }
  | { readonly outcome: 'challenge'; readonly challenge: SignInChallenge };
