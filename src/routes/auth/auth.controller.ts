import type {
  CodeSent as InternalCodeSent,
  SessionIssued,
} from '@cadenway/contracts/types/internal/identity-service';
import type { CodeSent, SignInMethods, SignedIn } from '@cadenway/contracts/types/public/auth';
import {
  DiscoverSignInMethodsBody,
  RequestSignInCodeBody,
  ResendSignUpCodeBody,
  SignInWithCodeBody,
  SignInWithPasswordBody,
  SignOutBody,
  SignUpBody,
  VerifySignUpBody,
} from '@cadenway/contracts/validators/public/auth';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { CsrfGuard } from '../../auth/csrf.guard.js';
import { CLEARED_SESSION_COOKIE, sessionCookieHeader } from '../../auth/session-cookie.js';
import { OptionalSession, SessionGuard } from '../../auth/session.guard.js';
import { verifiedSessionOf, type VerifiedSession } from '../../auth/verified-session.js';
import {
  isUpstreamProblem,
  relayUpstream,
  type AcceptedProblems,
} from '../../problems/upstream-problem.js';
import { toCurrentUser } from '../current-user.js';
import { browserClient } from './browser-client.js';
import { IDENTITY_AUTH, type IdentityAuth } from './identity-auth.port.js';

/**
 * Constant INVALID_REQUEST
 *
 * @description
 * The `400` every route of `openapi/public/auth.yaml` that has a body declares.
 *
 * @type {readonly string[]}
 */
const INVALID_REQUEST: readonly string[] = ['request.invalid'];

/**
 * Constant SIGN_IN_METHODS_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-in-methods` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const SIGN_IN_METHODS_PROBLEMS: AcceptedProblems = { 400: INVALID_REQUEST };

/**
 * Constant SIGN_UP_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-up` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const SIGN_UP_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  409: ['auth.email-taken'],
  422: ['auth.terms-not-accepted', 'auth.password-too-short', 'auth.password-compromised'],
  429: ['auth.code-throttled'],
};

/**
 * Constant CODE_REQUEST_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-up/code` and
 * `POST /v1/auth/sign-in/code` answer as they are.
 *
 * @type {AcceptedProblems}
 */
const CODE_REQUEST_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  429: ['auth.code-throttled'],
};

/**
 * Constant CODE_VERIFICATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-up/verification` and
 * `POST /v1/auth/sign-in/code/verification` answer as they are.
 *
 * @type {AcceptedProblems}
 */
const CODE_VERIFICATION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: ['auth.code-invalid', 'auth.code-expired'],
};

/**
 * Constant PASSWORD_SIGN_IN_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-in` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const PASSWORD_SIGN_IN_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  403: ['auth.email-not-verified'],
  422: ['auth.invalid-credentials'],
  429: ['auth.account-locked'],
};

/**
 * Constant SIGN_OUT_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-out` answers as they are: none. The
 * revocation has no body and its path comes from the introspection, so an internal `400` is a
 * defect of the gateway or of identity-service, answered `503 upstream.failed`, never blamed on
 * the browser. A `404 session.not-found` means the session already ended, which the sign-out
 * treats as done.
 *
 * @type {AcceptedProblems}
 */
const SIGN_OUT_PROBLEMS: AcceptedProblems = {};

/**
 * Constant STRICT_SIGN_OUT_BODY
 *
 * @description
 * Validator of the body of the sign-out: an empty object, with no other member
 * (`additionalProperties: false` in the contract, which the generated validator does not enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const STRICT_SIGN_OUT_BODY: z.ZodType<Record<string, never>> = SignOutBody.strict();

/**
 * Function toCodeSent
 *
 * @description
 * Maps the answer of a code request to `CodeSent` of the public contract, member by member.
 *
 * @param {InternalCodeSent} sent - Answer of identity-service.
 * @returns {CodeSent} The public answer.
 */
function toCodeSent(sent: InternalCodeSent): CodeSent {
  return {
    email: sent.email,
    expiresAt: sent.expiresAt,
    resendAvailableAt: sent.resendAvailableAt,
  };
}

/**
 * Class AuthController
 *
 * @description
 * The routes of `openapi/public/auth.yaml` under `/v1/auth`: discovery of the sign-in methods,
 * sign-up and its verification, sign-in by password or by email code, and sign-out. Each maps the
 * public request to its internal call of `openapi/internal/identity-service.yaml`, and the internal
 * answer back to the public contract, member by member.
 *
 * - Every route is `POST` and passes `CsrfGuard` first: an exact allowed `Origin` and
 *   `Content-Type: application/json`, signed in or not (the login cross-site decision of
 *   docs/integration.md). Every
 *   answer carries `Cache-Control: no-store` (see `AuthRoutesModule`).
 * - The flows carry no session (`security: []`): they never read the cookie, so a stale one never
 *   makes them fail, and identity-service sees them as the actor `anonymous`.
 * - The routes that sign in set `__Host-cw_session` from the token identity-service returns once
 *   (`Max-Age` only for a persistent session) and answer the user and the session, never the
 *   token. The browser's address and User-Agent travel in `client`.
 * - A client error of identity-service is answered as the public problem of its code, with the
 *   French title of the gateway and `Retry-After` for a `429`, when the public operation declares
 *   it; any other answer is `503 upstream.*` (see `relayUpstream`).
 */
@Controller('v1/auth')
@UseGuards(CsrfGuard)
export class AuthController {
  // #region Properties
  /**
   * Property identity
   *
   * @description
   * The internal routes of identity-service.
   *
   * @type {IdentityAuth}
   * @readonly
   */
  private readonly identity: IdentityAuth;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the port of the internal authentication routes.
   *
   * @param {IdentityAuth} identity - The internal routes of identity-service.
   * @constructor
   */
  public constructor(@Inject(IDENTITY_AUTH) identity: IdentityAuth) {
    this.identity = identity;
  }
  // #endregion

  // #region Methods
  /**
   * Method discoverSignInMethods
   *
   * @description
   * `POST /v1/auth/sign-in-methods`: the methods the sign-in screen offers for an address, the
   * same for every address today. `200`.
   *
   * @param {z.output<typeof DiscoverSignInMethodsBody>} body - The address.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<SignInMethods>} The methods, in the order to show them.
   */
  @Post('sign-in-methods')
  @HttpCode(200)
  public async discoverSignInMethods(
    @Body(new ZodValidationPipe(DiscoverSignInMethodsBody))
    body: z.output<typeof DiscoverSignInMethodsBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInMethods> {
    const methods: SignInMethods = await relayUpstream(response, SIGN_IN_METHODS_PROBLEMS, () =>
      this.identity.discoverSignInMethods({ email: body.email }),
    );
    return { methods: methods.methods.map((method) => ({ type: method.type })) };
  }

  /**
   * Method signUp
   *
   * @description
   * `POST /v1/auth/sign-up`: creates an unverified account and sends a code. `202`, no session.
   *
   * @param {z.output<typeof SignUpBody>} body - Name, address, password and acceptance of the
   * terms.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<CodeSent>} When the code expires and when another can be asked for.
   */
  @Post('sign-up')
  @HttpCode(202)
  public async signUp(
    @Body(new ZodValidationPipe(SignUpBody)) body: z.output<typeof SignUpBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CodeSent> {
    return toCodeSent(
      await relayUpstream(response, SIGN_UP_PROBLEMS, () =>
        this.identity.signUp({
          name: body.name,
          email: body.email,
          password: body.password,
          acceptTerms: body.acceptTerms,
        }),
      ),
    );
  }

  /**
   * Method resendSignUpCode
   *
   * @description
   * `POST /v1/auth/sign-up/code`: sends a new sign-up code. `202` for any address.
   *
   * @param {z.output<typeof ResendSignUpCodeBody>} body - The address.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was sent.
   */
  @Post('sign-up/code')
  @HttpCode(202)
  public async resendSignUpCode(
    @Body(new ZodValidationPipe(ResendSignUpCodeBody)) body: z.output<typeof ResendSignUpCodeBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CodeSent> {
    return toCodeSent(
      await relayUpstream(response, CODE_REQUEST_PROBLEMS, () =>
        this.identity.resendSignUpCode({ email: body.email }),
      ),
    );
  }

  /**
   * Method verifySignUp
   *
   * @description
   * `POST /v1/auth/sign-up/verification`: checks the sign-up code, then signs in. `200` with the
   * session cookie.
   *
   * @param {z.output<typeof VerifySignUpBody>} body - Address, code and `rememberMe`.
   * @param {Request} request - Request, for the browser's address and User-Agent.
   * @param {Response} response - Response, for the cookie.
   * @returns {Promise<SignedIn>} The user and the session.
   */
  @Post('sign-up/verification')
  @HttpCode(200)
  public async verifySignUp(
    @Body(new ZodValidationPipe(VerifySignUpBody)) body: z.output<typeof VerifySignUpBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn> {
    const issued: SessionIssued = await relayUpstream(response, CODE_VERIFICATION_PROBLEMS, () =>
      this.identity.verifySignUp({
        email: body.email,
        code: body.code,
        rememberMe: body.rememberMe,
        client: browserClient(request),
      }),
    );
    return this.signIn(response, issued);
  }

  /**
   * Method signInWithPassword
   *
   * @description
   * `POST /v1/auth/sign-in`: checks an address and its password, with the lockout of
   * identity-service. `200` with the session cookie.
   *
   * @param {z.output<typeof SignInWithPasswordBody>} body - Address, password and `rememberMe`.
   * @param {Request} request - Request, for the browser's address and User-Agent.
   * @param {Response} response - Response, for the cookie and `Retry-After`.
   * @returns {Promise<SignedIn>} The user and the session.
   */
  @Post('sign-in')
  @HttpCode(200)
  public async signInWithPassword(
    @Body(new ZodValidationPipe(SignInWithPasswordBody))
    body: z.output<typeof SignInWithPasswordBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn> {
    const issued: SessionIssued = await relayUpstream(response, PASSWORD_SIGN_IN_PROBLEMS, () =>
      this.identity.signInWithPassword({
        email: body.email,
        password: body.password,
        rememberMe: body.rememberMe,
        client: browserClient(request),
      }),
    );
    return this.signIn(response, issued);
  }

  /**
   * Method requestSignInCode
   *
   * @description
   * `POST /v1/auth/sign-in/code`: sends a sign-in code when a verified account uses the address.
   * `202` for any address.
   *
   * @param {z.output<typeof RequestSignInCodeBody>} body - The address.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was sent.
   */
  @Post('sign-in/code')
  @HttpCode(202)
  public async requestSignInCode(
    @Body(new ZodValidationPipe(RequestSignInCodeBody))
    body: z.output<typeof RequestSignInCodeBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CodeSent> {
    return toCodeSent(
      await relayUpstream(response, CODE_REQUEST_PROBLEMS, () =>
        this.identity.requestSignInCode({ email: body.email }),
      ),
    );
  }

  /**
   * Method signInWithCode
   *
   * @description
   * `POST /v1/auth/sign-in/code/verification`: checks a sign-in code. `200` with the session
   * cookie.
   *
   * @param {z.output<typeof SignInWithCodeBody>} body - Address, code and `rememberMe`.
   * @param {Request} request - Request, for the browser's address and User-Agent.
   * @param {Response} response - Response, for the cookie.
   * @returns {Promise<SignedIn>} The user and the session.
   */
  @Post('sign-in/code/verification')
  @HttpCode(200)
  public async signInWithCode(
    @Body(new ZodValidationPipe(SignInWithCodeBody)) body: z.output<typeof SignInWithCodeBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn> {
    const issued: SessionIssued = await relayUpstream(response, CODE_VERIFICATION_PROBLEMS, () =>
      this.identity.signInWithCode({
        email: body.email,
        code: body.code,
        rememberMe: body.rememberMe,
        client: browserClient(request),
      }),
    );
    return this.signIn(response, issued);
  }

  /**
   * Method signOut
   *
   * @description
   * `POST /v1/auth/sign-out`: closes the session of the cookie, on this browser only, then clears
   * the cookie and answers `204`. The session is optional: without a cookie, with one that is no
   * longer active, or when identity-service says the session already ended, nothing is revoked and
   * the answer is the same, so signing out twice is not an error. When identity-service cannot
   * answer, the route answers `503` and leaves the cookie, so that the sign-out can be retried
   * rather than leave an active session the browser no longer knows.
   *
   * @param {z.output<typeof STRICT_SIGN_OUT_BODY>} _body - The empty object.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response, for the cleared cookie.
   * @returns {Promise<void>} Resolves once the session is closed.
   */
  @Post('sign-out')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @OptionalSession()
  public async signOut(
    @Body(new ZodValidationPipe(STRICT_SIGN_OUT_BODY)) _body: z.output<typeof STRICT_SIGN_OUT_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const session: VerifiedSession | undefined = verifiedSessionOf(request);
    if (session !== undefined) {
      await relayUpstream(response, SIGN_OUT_PROBLEMS, async () => {
        try {
          await this.identity.revokeSession(session.sessionId);
        } catch (error) {
          if (!isUpstreamProblem(error, 404, 'session.not-found')) {
            throw error;
          }
        }
      });
    }
    response.setHeader('Set-Cookie', CLEARED_SESSION_COOKIE);
  }

  /**
   * Method signIn
   *
   * @description
   * Completes a route that signs in: sets the session cookie from the token, which leaves the
   * gateway in this header only, and answers the user and the session (its id and expiry).
   *
   * @param {Response} response - Response of the request.
   * @param {SessionIssued} issued - Session opened by identity-service.
   * @returns {SignedIn} The public answer.
   */
  private signIn(response: Response, issued: SessionIssued): SignedIn {
    response.setHeader('Set-Cookie', sessionCookieHeader(issued.token, issued.session, new Date()));
    return {
      user: toCurrentUser(issued.user),
      session: { id: issued.session.id, expiresAt: issued.session.expiresAt },
    };
  }
  // #endregion
}
