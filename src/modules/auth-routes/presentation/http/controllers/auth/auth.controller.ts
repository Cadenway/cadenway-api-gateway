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

import { CsrfGuard } from '../../../../../auth/public/session/csrf-guard.js';
import {
  CLEARED_SESSION_COOKIE,
  sessionCookieHeader,
} from '../../../../../../presentation/http/session/session-cookie.js';
import { SessionGuard } from '../../../../../auth/public/session/session-guard.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import {
  isUpstreamProblem,
  relayUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { toCurrentUser } from '../../../../../../presentation/http/mappers/current-user.mapper.js';
import { browserClient } from '../../mappers/auth/browser-client.mapper.js';
import { DiscoverSignInMethods } from '../../../../application/use-cases/queries/auth/discover-sign-in-methods/discover-sign-in-methods.use-case.js';
import { SignUp } from '../../../../application/use-cases/commands/auth/sign-up/sign-up.use-case.js';
import { ResendSignUpCode } from '../../../../application/use-cases/commands/auth/resend-sign-up-code/resend-sign-up-code.use-case.js';
import { VerifySignUp } from '../../../../application/use-cases/commands/auth/verify-sign-up/verify-sign-up.use-case.js';
import { SignInWithPassword } from '../../../../application/use-cases/commands/auth/sign-in-with-password/sign-in-with-password.use-case.js';
import { RequestSignInCode } from '../../../../application/use-cases/commands/auth/request-sign-in-code/request-sign-in-code.use-case.js';
import { SignInWithCode } from '../../../../application/use-cases/commands/auth/sign-in-with-code/sign-in-with-code.use-case.js';
import { SignOut } from '../../../../application/use-cases/commands/auth/sign-out/sign-out.use-case.js';

import type { CodeSent as InternalCodeSent } from '../../../../application/models/auth/code-sent.model.js';
import type { SessionIssued } from '../../../../application/models/auth/session-issued.model.js';

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
 * Constant CODE_REFUSALS
 *
 * @description
 * The `422` codes of a refused one-time code (`CodeRefused` of the public contract), declared by
 * both code verifications.
 *
 * @type {readonly string[]}
 */
const CODE_REFUSALS: readonly string[] = ['auth.code-invalid', 'auth.code-expired'];

/**
 * Constant SIGN_UP_VERIFICATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-up/verification` answers as they
 * are: the refused codes, and `auth.sign-up-replaced` when the right code comes with a password
 * that is not the one of the latest sign-up of the address, or without one after a repeated
 * sign-up (`SignUpVerificationRefused`).
 *
 * @type {AcceptedProblems}
 */
const SIGN_UP_VERIFICATION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: [...CODE_REFUSALS, 'auth.sign-up-replaced'],
};

/**
 * Constant CODE_VERIFICATION_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/auth/sign-in/code/verification` answers as
 * they are: the refused codes only. Its contract declares no `auth.sign-up-replaced`, so that code
 * answers `503 upstream.failed` there.
 *
 * @type {AcceptedProblems}
 */
const CODE_VERIFICATION_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  422: CODE_REFUSALS,
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
   * Property discoverSignInMethodsUseCase
   *
   * @description
   * Reads the sign-in methods available for the address.
   *
   * @type {DiscoverSignInMethods}
   * @readonly
   */
  private readonly discoverSignInMethodsUseCase: DiscoverSignInMethods;

  /**
   * Property signUpUseCase
   *
   * @description
   * Registers an unverified account and requests a verification code.
   *
   * @type {SignUp}
   * @readonly
   */
  private readonly signUpUseCase: SignUp;

  /**
   * Property resendSignUpCodeUseCase
   *
   * @description
   * Requests another code for an unverified account.
   *
   * @type {ResendSignUpCode}
   * @readonly
   */
  private readonly resendSignUpCodeUseCase: ResendSignUpCode;

  /**
   * Property verifySignUpUseCase
   *
   * @description
   * Verifies the account registration and opens a session when Identity accepts the proof.
   *
   * @type {VerifySignUp}
   * @readonly
   */
  private readonly verifySignUpUseCase: VerifySignUp;

  /**
   * Property signInWithPasswordUseCase
   *
   * @description
   * Opens a session when Identity accepts the email and password.
   *
   * @type {SignInWithPassword}
   * @readonly
   */
  private readonly signInWithPasswordUseCase: SignInWithPassword;

  /**
   * Property requestSignInCodeUseCase
   *
   * @description
   * Requests a one-time sign-in code for the address.
   *
   * @type {RequestSignInCode}
   * @readonly
   */
  private readonly requestSignInCodeUseCase: RequestSignInCode;

  /**
   * Property signInWithCodeUseCase
   *
   * @description
   * Opens a session after Identity verifies the sign-in code.
   *
   * @type {SignInWithCode}
   * @readonly
   */
  private readonly signInWithCodeUseCase: SignInWithCode;

  /**
   * Property signOutUseCase
   *
   * @description
   * Revokes the current session through Identity.
   *
   * @type {SignOut}
   * @readonly
   */
  private readonly signOutUseCase: SignOut;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases driven by the public authentication routes.
   *
   * @param {DiscoverSignInMethods} discoverSignInMethodsUseCase - Reads the sign-in methods available for the address.
   * @param {SignUp} signUpUseCase - Registers an unverified account and requests a verification code.
   * @param {ResendSignUpCode} resendSignUpCodeUseCase - Requests another code for an unverified account.
   * @param {VerifySignUp} verifySignUpUseCase - Verifies the account registration and opens a session when Identity accepts the proof.
   * @param {SignInWithPassword} signInWithPasswordUseCase - Opens a session when Identity accepts the email and password.
   * @param {RequestSignInCode} requestSignInCodeUseCase - Requests a one-time sign-in code for the address.
   * @param {SignInWithCode} signInWithCodeUseCase - Opens a session after Identity verifies the sign-in code.
   * @param {SignOut} signOutUseCase - Revokes the current session through Identity.
   * @constructor
   */
  public constructor(
    @Inject(DiscoverSignInMethods) discoverSignInMethodsUseCase: DiscoverSignInMethods,
    @Inject(SignUp) signUpUseCase: SignUp,
    @Inject(ResendSignUpCode) resendSignUpCodeUseCase: ResendSignUpCode,
    @Inject(VerifySignUp) verifySignUpUseCase: VerifySignUp,
    @Inject(SignInWithPassword) signInWithPasswordUseCase: SignInWithPassword,
    @Inject(RequestSignInCode) requestSignInCodeUseCase: RequestSignInCode,
    @Inject(SignInWithCode) signInWithCodeUseCase: SignInWithCode,
    @Inject(SignOut) signOutUseCase: SignOut,
  ) {
    this.discoverSignInMethodsUseCase = discoverSignInMethodsUseCase;
    this.signUpUseCase = signUpUseCase;
    this.resendSignUpCodeUseCase = resendSignUpCodeUseCase;
    this.verifySignUpUseCase = verifySignUpUseCase;
    this.signInWithPasswordUseCase = signInWithPasswordUseCase;
    this.requestSignInCodeUseCase = requestSignInCodeUseCase;
    this.signInWithCodeUseCase = signInWithCodeUseCase;
    this.signOutUseCase = signOutUseCase;
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
      this.discoverSignInMethodsUseCase.execute({ email: body.email }),
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
        this.signUpUseCase.execute({
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
        this.resendSignUpCodeUseCase.execute({ email: body.email }),
      ),
    );
  }

  /**
   * Method verifySignUp
   *
   * @description
   * `POST /v1/auth/sign-up/verification`: checks the sign-up code and the password of the sign-up,
   * then signs in. `200` with the session cookie.
   *
   * The `password` of the body, the one typed in the sign-up form, binds the verification to that
   * sign-up: it travels to identity-service unchanged when the browser sent one, and is left out
   * when it did not, so that identity-service alone decides whether the code suffices. It is never
   * logged. identity-service answers `422 auth.sign-up-replaced` when, with the right code, it is
   * not the password of the latest sign-up of the address, or is missing after a repeated sign-up.
   *
   * @param {z.output<typeof VerifySignUpBody>} body - Address, code, `rememberMe` and the optional
   * password of the sign-up.
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
    const issued: SessionIssued = await relayUpstream(response, SIGN_UP_VERIFICATION_PROBLEMS, () =>
      this.verifySignUpUseCase.execute({
        email: body.email,
        code: body.code,
        rememberMe: body.rememberMe,
        ...(body.password === undefined ? {} : { password: body.password }),
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
      this.signInWithPasswordUseCase.execute({
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
        this.requestSignInCodeUseCase.execute({ email: body.email }),
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
      this.signInWithCodeUseCase.execute({
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
  @SessionGuard.optional()
  public async signOut(
    @Body(new ZodValidationPipe(STRICT_SIGN_OUT_BODY)) _body: z.output<typeof STRICT_SIGN_OUT_BODY>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const session: RequestSession | undefined = verifiedSessionOf(request);
    if (session !== undefined) {
      await relayUpstream(response, SIGN_OUT_PROBLEMS, async () => {
        try {
          await this.signOutUseCase.execute(session.sessionId);
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
