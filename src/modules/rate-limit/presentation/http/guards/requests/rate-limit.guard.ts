import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { rateLimitExceededProblem } from '../../../../../../problems/credential-problems.js';
import {
  verifiedCredentialOf,
  type RequestCredential,
} from '../../../../../../presentation/http/session/request-session.js';
import type { RequestAllowance } from '../../../../application/models/requests/request-allowance.model.js';
import { CountRequest } from '../../../../application/use-cases/commands/requests/count-request/count-request.use-case.js';

/**
 * Class RateLimitGuard
 *
 * @description
 * Limits the requests of each verified credential: 600 per minute per session or personal API
 * token, counted on its id, never on its secret. It runs after the credential guard of
 * `src/modules/auth/`, which attaches the credential, so a request refused by that guard (`401`,
 * `403`) is not counted. A request beyond the quota answers `429 rate-limit.exceeded` with
 * `Retry-After`, the whole seconds until the window ends; the contracts declare no `RateLimit`
 * header, so none is sent. A request without a credential (a route of `security: []`, or a
 * sign-out without an active session) is not counted here.
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
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the counting use case.
   *
   * @param {CountRequest} counter - Counts the requests of a credential.
   * @constructor
   */
  public constructor(@Inject(CountRequest) counter: CountRequest) {
    this.counter = counter;
  }
  // #endregion

  // #region Methods
  /**
   * Method canActivate
   *
   * @description
   * Counts the request of its credential, or lets a request without one through.
   *
   * @param {ExecutionContext} context - Execution context of the request.
   * @returns {Promise<boolean>} `true` when the request may continue.
   * @throws {ProblemException} 429 `rate-limit.exceeded`, with `Retry-After` set on the response.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const credential: RequestCredential | undefined = verifiedCredentialOf(request);
    if (credential === undefined) {
      return true;
    }
    const allowance: RequestAllowance = await this.counter.execute({
      credentialKind: credential.kind,
      credentialId: credential.id,
    });
    if (!allowance.allowed) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', String(allowance.retryAfterSeconds));
      throw rateLimitExceededProblem();
    }
    return true;
  }
  // #endregion
}
