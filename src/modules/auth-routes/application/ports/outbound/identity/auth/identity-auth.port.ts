import type { DiscoverSignInMethodsInput } from '../../../../use-cases/queries/auth/discover-sign-in-methods/discover-sign-in-methods.input.js';
import type { DiscoverSignInMethodsOutput } from '../../../../use-cases/queries/auth/discover-sign-in-methods/discover-sign-in-methods.output.js';
import type { SignUpInput } from '../../../../use-cases/commands/auth/sign-up/sign-up.input.js';
import type { CodeRequest } from '../../../../models/auth/code-request.model.js';
import type { CodeSent } from '../../../../models/auth/code-sent.model.js';
import type { VerifySignUpInput } from '../../../../use-cases/commands/auth/verify-sign-up/verify-sign-up.input.js';
import type { SignInWithCodeInput } from '../../../../use-cases/commands/auth/sign-in-with-code/sign-in-with-code.input.js';
import type { SignInWithPasswordInput } from '../../../../use-cases/commands/auth/sign-in-with-password/sign-in-with-password.input.js';
import type { SessionIssued } from '../../../../models/auth/session-issued.model.js';
import type { RequestPasswordResetInput } from '../../../../use-cases/commands/auth/request-password-reset/request-password-reset.input.js';
import type { PasswordResetLinkSent } from '../../../../models/auth/password-reset-link-sent.model.js';
import type { InspectPasswordResetLinkInput } from '../../../../use-cases/queries/auth/inspect-password-reset-link/inspect-password-reset-link.input.js';
import type { PasswordResetLink } from '../../../../models/auth/password-reset-link.model.js';
import type { ConfirmPasswordResetInput } from '../../../../use-cases/commands/auth/confirm-password-reset/confirm-password-reset.input.js';
import type { PasswordResetCompleted } from '../../../../models/auth/password-reset-completed.model.js';
import type { RecentAuthentication } from '../../../../models/auth/recent-authentication.model.js';

/**
 * Interface IdentityAuth
 *
 * @description
 * Outgoing port of the routes of `openapi/public/auth.yaml` under `/v1/auth`: the internal routes
 * of `openapi/internal/identity-service.yaml` they call. The local adapter delegates to the shared
 * client, which signs the flows before a session (sign-up, sign-in, password reset) as the actor
 * `anonymous`, and the revocation and the re-authentication as the user of the current
 * organization context.
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of identity-service with its `code` and `details`, or
 * `503 upstream.*` when identity-service cannot answer or answers outside its contract.
 */
export interface IdentityAuth {
  // #region Methods
  /**
   * Method discoverSignInMethods
   *
   * @description
   * `POST /internal/v1/auth/sign-in-methods`.
   *
   * @param {DiscoverSignInMethodsInput} request - Address to discover the methods of.
   * @returns {Promise<DiscoverSignInMethodsOutput>} The methods to offer.
   */
  discoverSignInMethods(request: DiscoverSignInMethodsInput): Promise<DiscoverSignInMethodsOutput>;

  /**
   * Method signUp
   *
   * @description
   * `POST /internal/v1/auth/sign-up`.
   *
   * @param {SignUpInput} request - Name, address, password and acceptance of the terms.
   * @returns {Promise<CodeSent>} When the code expires and when another can be asked for.
   */
  signUp(request: SignUpInput): Promise<CodeSent>;

  /**
   * Method resendSignUpCode
   *
   * @description
   * `POST /internal/v1/auth/sign-up/code`.
   *
   * @param {CodeRequest} request - Address awaiting a sign-up code.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was issued.
   */
  resendSignUpCode(request: CodeRequest): Promise<CodeSent>;

  /**
   * Method verifySignUp
   *
   * @description
   * `POST /internal/v1/auth/sign-up/verification`. Rejects with `422 auth.sign-up-replaced` when,
   * with the right code, `password` is not the one of the latest sign-up of the address, or is
   * missing after a repeated sign-up.
   *
   * @param {VerifySignUpInput} request - Address, code, the password of the sign-up when the
   * browser sent one, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  verifySignUp(request: VerifySignUpInput): Promise<SessionIssued>;

  /**
   * Method signInWithPassword
   *
   * @description
   * `POST /internal/v1/auth/sign-in`.
   *
   * @param {SignInWithPasswordInput} request - Address, password, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  signInWithPassword(request: SignInWithPasswordInput): Promise<SessionIssued>;

  /**
   * Method requestSignInCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/code`.
   *
   * @param {CodeRequest} request - Address to send a sign-in code to.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was issued.
   */
  requestSignInCode(request: CodeRequest): Promise<CodeSent>;

  /**
   * Method signInWithCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/code/verification`.
   *
   * @param {SignInWithCodeInput} request - Address, code, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  signInWithCode(request: SignInWithCodeInput): Promise<SessionIssued>;

  /**
   * Method revokeSession
   *
   * @description
   * `DELETE /internal/v1/sessions/{sessionId}`, for the user of the current organization context.
   *
   * @param {string} sessionId - Id of the session, as the introspection returned it.
   * @returns {Promise<void>} Resolves once the session is revoked, or had already ended.
   */
  revokeSession(sessionId: string): Promise<void>;

  /**
   * Method requestPasswordReset
   *
   * @description
   * `POST /internal/v1/auth/password-reset`. Rejects with `429 auth.reset-throttled`.
   *
   * @param {RequestPasswordResetInput} request - Address and browser that asks for the link.
   * @returns {Promise<PasswordResetLinkSent>} The same answer whether or not a link was issued.
   */
  requestPasswordReset(request: RequestPasswordResetInput): Promise<PasswordResetLinkSent>;

  /**
   * Method inspectPasswordResetLink
   *
   * @description
   * `POST /internal/v1/auth/password-reset/inspection`. Rejects with
   * `422 auth.reset-link-expired`.
   *
   * @param {InspectPasswordResetLinkInput} request - The token of the link.
   * @returns {Promise<PasswordResetLink>} The account of the link.
   */
  inspectPasswordResetLink(request: InspectPasswordResetLinkInput): Promise<PasswordResetLink>;

  /**
   * Method confirmPasswordReset
   *
   * @description
   * `POST /internal/v1/auth/password-reset/confirmation`. Rejects with
   * `422 auth.reset-link-expired`, `auth.password-too-short` or `auth.password-compromised`.
   *
   * @param {ConfirmPasswordResetInput} request - Token, new password, sessions choice, browser.
   * @returns {Promise<PasswordResetCompleted>} The address of the account and the sessions closed.
   */
  confirmPasswordReset(request: ConfirmPasswordResetInput): Promise<PasswordResetCompleted>;

  /**
   * Method reauthenticate
   *
   * @description
   * `POST /internal/v1/sessions/{sessionId}/reauthentication`, for the user of the current
   * organization context. Rejects with `422 auth.password-incorrect`, `429 auth.account-locked`,
   * or `404 session.not-found` when the session is no longer an open session of the user.
   *
   * @param {string} sessionId - Id of the session, as the introspection returned it.
   * @param {string} password - The password of the account.
   * @returns {Promise<RecentAuthentication>} The window of recent authentication.
   */
  reauthenticate(sessionId: string, password: string): Promise<RecentAuthentication>;
  // #endregion
}
