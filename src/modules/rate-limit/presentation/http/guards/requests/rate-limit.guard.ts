import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  anonymousRateLimitExceededProblem,
  rateLimitExceededProblem,
} from '../../../../../../problems/credential-problems.js';
import { toClientAddress } from '../../../../../../presentation/http/mappers/client-address.mapper.js';
import {
  verifiedCredentialOf,
  type RequestCredential,
} from '../../../../../../presentation/http/session/request-session.js';
import type { RequestAllowance } from '../../../../application/models/requests/request-allowance.model.js';
import { CountAnonymousRequest } from '../../../../application/use-cases/commands/addresses/count-anonymous-request/count-anonymous-request.use-case.js';
import { CountRequest } from '../../../../application/use-cases/commands/requests/count-request/count-request.use-case.js';

/**
 * Class RateLimitGuard
 *
 * @description
 * Limits the requests of each verified credential, and of each client address without one. It
 * runs after the credential guard of `src/modules/auth/`, which attaches the credential, so a
 * request refused by that guard (`401`, `403`) is not counted here.
 *
 * - A request with a verified session or personal API token counts against that credential only:
 *   600 per minute, on its id, never on its secret, whatever its address.
 * - A request without one, which reaches this guard only on a route whose credential is absent or
 *   optional (the routes of `openapi/public/auth.yaml` with `security: []`, and a sign-out without
 *   an active session), counts against its client address: 60 per minute, on a keyed hash of the
 *   address Traefik saw, never the address itself.
 *
 * Beyond, it answers `429 rate-limit.exceeded` with `Retry-After`, the whole seconds until the
 * window ends; the contracts declare no `RateLimit` header, so none is sent.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  // #region Properties
  /**
   * Property counter
   *
   * @description
   * Counts the requests of a credential.
   *
   * @type {CountRequest}
   * @readonly
   */
  private readonly counter: CountRequest;

  /**
   * Property anonymousCounter
   *
   * @description
   * Counts the requests without a credential of a client address.
   *
   * @type {CountAnonymousRequest}
   * @readonly
   */
  private readonly anonymousCounter: CountAnonymousRequest;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the counting use cases.
   *
   * @param {CountRequest} counter - Counts the requests of a credential.
   * @param {CountAnonymousRequest} anonymousCounter - Counts the requests without a credential.
   * @constructor
   */
  public constructor(
    @Inject(CountRequest) counter: CountRequest,
    @Inject(CountAnonymousRequest) anonymousCounter: CountAnonymousRequest,
  ) {
    this.counter = counter;
    this.anonymousCounter = anonymousCounter;
  }
  // #endregion

  // #region Methods
  /**
   * Method canActivate
   *
   * @description
   * Counts the request against its credential, or against its client address without one.
   *
   * @param {ExecutionContext} context - Execution context of the request.
   * @returns {Promise<boolean>} `true` when the request may continue.
   * @throws {ProblemException} 429 `rate-limit.exceeded`, with `Retry-After` set on the response.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const credential: RequestCredential | undefined = verifiedCredentialOf(request);
    const allowance: RequestAllowance =
      credential === undefined
        ? await this.anonymousCounter.execute({ clientAddress: toClientAddress(request) })
        : await this.counter.execute({
            credentialKind: credential.kind,
            credentialId: credential.id,
          });
    if (!allowance.allowed) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', String(allowance.retryAfterSeconds));
      throw credential === undefined
        ? anonymousRateLimitExceededProblem()
        : rateLimitExceededProblem();
    }
    return true;
  }
  // #endregion
}
