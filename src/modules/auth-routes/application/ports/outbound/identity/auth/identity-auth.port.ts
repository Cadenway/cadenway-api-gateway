import type { SignInMethodsRequest } from '../../../../use-cases/queries/auth/discover-sign-in-methods/discover-sign-in-methods.input.js';
import type { SignInMethods } from '../../../../use-cases/queries/auth/discover-sign-in-methods/discover-sign-in-methods.output.js';
import type { SignUpRequest } from '../../../../use-cases/commands/auth/sign-up/sign-up.input.js';
import type { CodeRequest } from '../../../../models/auth/code-request.model.js';
import type { CodeSent } from '../../../../models/auth/code-sent.model.js';
import type { SignUpVerification } from '../../../../use-cases/commands/auth/verify-sign-up/verify-sign-up.input.js';
import type { CodeVerification } from '../../../../use-cases/commands/auth/sign-in-with-code/sign-in-with-code.input.js';
import type { PasswordSignIn } from '../../../../use-cases/commands/auth/sign-in-with-password/sign-in-with-password.input.js';
import type { SessionIssued } from '../../../../models/auth/session-issued.model.js';

/**
 * Interface IdentityAuth
 *
 * @description
 * Outgoing port of the routes of `openapi/public/auth.yaml`: the internal routes of
 * `openapi/internal/identity-service.yaml` they call. The local adapter delegates to the shared client, which signs the flows as
 * the actor `anonymous` and the revocation as the user of the current organization context.
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
   * @param {SignInMethodsRequest} request - Address to discover the methods of.
   * @returns {Promise<SignInMethods>} The methods to offer.
   */
  discoverSignInMethods(request: SignInMethodsRequest): Promise<SignInMethods>;

  /**
   * Method signUp
   *
   * @description
   * `POST /internal/v1/auth/sign-up`.
   *
   * @param {SignUpRequest} request - Name, address, password and acceptance of the terms.
   * @returns {Promise<CodeSent>} When the code expires and when another can be asked for.
   */
  signUp(request: SignUpRequest): Promise<CodeSent>;

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
   * @param {SignUpVerification} request - Address, code, the password of the sign-up when the
   * browser sent one, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  verifySignUp(request: SignUpVerification): Promise<SessionIssued>;

  /**
   * Method signInWithPassword
   *
   * @description
   * `POST /internal/v1/auth/sign-in`.
   *
   * @param {PasswordSignIn} request - Address, password, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  signInWithPassword(request: PasswordSignIn): Promise<SessionIssued>;

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
   * @param {CodeVerification} request - Address, code, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  signInWithCode(request: CodeVerification): Promise<SessionIssued>;

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
  // #endregion
}
