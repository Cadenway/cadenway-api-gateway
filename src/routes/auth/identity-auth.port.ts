import type {
  CodeRequest,
  CodeSent,
  CodeVerification,
  PasswordSignIn,
  SessionIssued,
  SignInMethods,
  SignInMethodsRequest,
  SignUpRequest,
} from '@cadenway/contracts/types/internal/identity-service';

/**
 * Interface IdentityAuth
 *
 * @description
 * Outgoing port of the routes of `openapi/public/auth.yaml`: the internal routes of
 * `openapi/internal/identity-service.yaml` they call, with the internal request and response
 * shapes. Implemented by the identity-service client of `src/clients/`, which signs the flows as
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
   * `POST /internal/v1/auth/sign-up/verification`.
   *
   * @param {CodeVerification} request - Address, code, persistence and browser of the session.
   * @returns {Promise<SessionIssued>} The session opened, with its token returned once.
   */
  verifySignUp(request: CodeVerification): Promise<SessionIssued>;

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

/**
 * Constant IDENTITY_AUTH
 *
 * @description
 * Injection token of the `IdentityAuth` port, provided globally by `ClientsModule`.
 *
 * @type {unique symbol}
 */
export const IDENTITY_AUTH: unique symbol = Symbol('IdentityAuth');
