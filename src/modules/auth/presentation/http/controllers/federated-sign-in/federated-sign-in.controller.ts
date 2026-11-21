import type {
  FederatedAuthorization,
  SignInChallenge,
  SignedIn,
} from '@cadenway/contracts/types/public/auth';
import {
  CompleteOAuthSignInParams,
  FinishFederatedSignInBody,
  StartFederatedSignInBody,
} from '@cadenway/contracts/validators/public/auth';
import { CONFIG, ZodValidationPipe, type ProblemException } from '@cadenway/nest-common';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { browserClient } from '../../../../../../presentation/http/mappers/browser-client.mapper.js';
import { toCurrentUser } from '../../../../../../presentation/http/mappers/current-user.mapper.js';
import {
  RequiredBody,
  toRequiredBody,
} from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { sessionCookieHeader } from '../../../../../../presentation/http/session/session-cookie.js';
import { readTrustedDeviceToken } from '../../../../../../presentation/http/session/trusted-device-cookie.js';
import { publicProblem } from '../../../../../../problems/public-problem.js';
import { isUpstreamProblem, toPublicProblem } from '../../../../../../problems/upstream-problem.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import type { FederatedReceipt } from '../../../../application/models/federated-sign-in/federated-receipt.model.js';
import { CompleteOauthSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-oauth-sign-in/complete-oauth-sign-in.use-case.js';
import { CompleteSamlSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-saml-sign-in/complete-saml-sign-in.use-case.js';
import { FinishFederatedSignIn } from '../../../../application/use-cases/commands/federated-sign-in/finish-federated-sign-in/finish-federated-sign-in.use-case.js';
import { StartFederatedSignIn } from '../../../../application/use-cases/commands/federated-sign-in/start-federated-sign-in/start-federated-sign-in.use-case.js';
import { CredentialGuard } from '../../guards/credential/credential.guard.js';
import { CsrfGuard } from '../../guards/session/csrf.guard.js';
import {
  CLEARED_FEDERATED_RECEIPT_COOKIE,
  federatedContinuationCookies,
  federatedFlowCookie,
  readFederatedFlow,
  readFederatedReceipt,
} from '../../mappers/federated-sign-in/federated-cookie.mapper.js';
import {
  readOAuthCallback,
  readSamlCallback,
} from '../../validation/federated-sign-in/federated-callback.validation.js';

const REFUSED = 'auth.federated-sign-in-refused';

function refused(): ProblemException {
  return publicProblem({ status: 422, code: REFUSED });
}

function unavailable(): ProblemException {
  return publicProblem({
    status: 503,
    code: 'upstream.unavailable',
    details: { service: 'identity-service' },
  });
}

async function fromIdentity<TResult>(call: () => Promise<TResult>): Promise<TResult> {
  try {
    return await call();
  } catch (error) {
    if (isUpstreamProblem(error, 422, REFUSED)) throw refused();
    if (isUpstreamProblem(error, 503, 'auth.federated-unavailable')) throw unavailable();
    throw toPublicProblem(error, {});
  }
}

function continueInWebapp(
  response: Response,
  location: string,
  provider: 'oauth' | 'saml',
  receipt: FederatedReceipt,
): void {
  response.setHeader('Location', location);
  response.setHeader(
    'Set-Cookie',
    federatedContinuationCookies(receipt.receipt, receipt.expiresAt, provider),
  );
  response.status(303).end();
}

/** Public browser endpoints for the signed-out federated sign-in flow. */
@Controller('v1/auth/sign-in/federated')
export class FederatedSignInController {
  // #region Constructor
  /** Receives the Identity-backed use case and the fixed validated web application URL. */
  public constructor(
    @Inject(StartFederatedSignIn) private readonly startSignIn: StartFederatedSignIn,
    @Inject(CompleteOauthSignIn) private readonly completeOAuthSignIn: CompleteOauthSignIn,
    @Inject(CompleteSamlSignIn) private readonly completeSamlSignIn: CompleteSamlSignIn,
    @Inject(FinishFederatedSignIn) private readonly finishSignIn: FinishFederatedSignIn,
    @Inject(CONFIG)
    private readonly config: { readonly FEDERATED_CONTINUATION_URL?: string | undefined },
  ) {}
  // #endregion

  // #region Methods
  /** Starts a signed-out flow from an allowed origin and sets its browser binding. */
  @Post('start')
  @UseGuards(CsrfGuard, CredentialGuard, RateLimitGuard)
  @CredentialGuard.requires({
    operationId: 'startFederatedSignIn',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async start(
    @RequiredBody(StartFederatedSignInBody) body: z.output<typeof StartFederatedSignInBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FederatedAuthorization> {
    this.continuationUrl();
    const flow = await fromIdentity(() => this.startSignIn.execute(body));
    response.setHeader('Set-Cookie', [
      federatedFlowCookie(
        flow.browserBinding,
        flow.expiresAt,
        body.provider === 'saml' ? 'saml' : 'oauth',
      ),
      CLEARED_FEDERATED_RECEIPT_COOKIE,
    ]);
    return { authorizationUrl: flow.authorizationUrl };
  }

  /** Validates the provider's query before sending the bound result to Identity. */
  @Get('providers/:provider/callback')
  @UseGuards(CredentialGuard, RateLimitGuard)
  @CredentialGuard.requires({
    operationId: 'completeOAuthSignIn',
    security: [],
    organization: false,
  })
  public async completeOAuth(
    @Param(new ZodValidationPipe(CompleteOAuthSignInParams))
    { provider }: z.output<typeof CompleteOAuthSignInParams>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const callback = readOAuthCallback(request.originalUrl);
    const browserBinding = readFederatedFlow(request);
    if (browserBinding === undefined) throw refused();

    const location = this.continuationUrl();
    const receipt = await fromIdentity(() =>
      this.completeOAuthSignIn.execute({ provider, browserBinding, ...callback }),
    );
    continueInWebapp(response, location, 'oauth', receipt);
  }

  /** Accepts the IdP's cross-site POST with the SAML flow cookie and no session. */
  @Post('saml/callback')
  @UseGuards(CredentialGuard, RateLimitGuard)
  @CredentialGuard.requires({
    operationId: 'completeSamlSignIn',
    security: [],
    organization: false,
  })
  public async completeSaml(@Req() request: Request, @Res() response: Response): Promise<void> {
    const { SAMLResponse, RelayState } = readSamlCallback(request);
    const browserBinding = readFederatedFlow(request);
    if (browserBinding === undefined) throw refused();

    const location = this.continuationUrl();
    const receipt = await fromIdentity(() =>
      this.completeSamlSignIn.execute({
        samlResponse: SAMLResponse,
        relayState: RelayState,
        browserBinding,
      }),
    );
    continueInWebapp(response, location, 'saml', receipt);
  }

  /** Redeems a receipt on a same-site JSON POST and returns the ordinary sign-in outcome. */
  @Post('finish')
  @UseGuards(CsrfGuard, CredentialGuard, RateLimitGuard)
  @CredentialGuard.requires({
    operationId: 'finishFederatedSignIn',
    security: [],
    organization: false,
  })
  @HttpCode(200)
  public async finish(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignedIn | SignInChallenge> {
    toRequiredBody(request, FinishFederatedSignInBody);
    response.setHeader('Set-Cookie', CLEARED_FEDERATED_RECEIPT_COOKIE);
    const receipt = readFederatedReceipt(request);
    if (receipt === undefined) throw refused();

    const trustedDeviceToken = readTrustedDeviceToken(request);
    const outcome = await fromIdentity(() =>
      this.finishSignIn.execute({
        receipt,
        client: browserClient(request),
        ...(trustedDeviceToken === undefined ? {} : { trustedDeviceToken }),
      }),
    );
    if (outcome.outcome === 'challenge') {
      response.status(202);
      const challenge = outcome.challenge;
      return {
        token: challenge.token,
        expiresAt: challenge.expiresAt,
        email: challenge.email,
        name: challenge.name,
        primaryMethod: challenge.primaryMethod,
        methods: [...challenge.methods],
        securityKeys: challenge.securityKeys.map(({ name }) => ({ name })),
        backupCodesRemaining: challenge.backupCodesRemaining,
        lockedUntil: challenge.lockedUntil,
      };
    }
    const { token, user, session, deletionCancelled } = outcome.session;
    response.setHeader('Set-Cookie', [
      CLEARED_FEDERATED_RECEIPT_COOKIE,
      sessionCookieHeader(token, session, new Date()),
    ]);
    return {
      user: toCurrentUser(user),
      session: { id: session.id, expiresAt: session.expiresAt },
      ...(deletionCancelled === undefined ? {} : { deletionCancelled }),
    };
  }

  /** Fails closed before starting or consuming a flow when no continuation is configured. */
  private continuationUrl(): string {
    const location = this.config.FEDERATED_CONTINUATION_URL;
    if (location === undefined) throw unavailable();
    return location;
  }
  // #endregion
}
