import type { AuthenticationPolicy } from '@cadenway/contracts/types/public/organizations';
import { UpdateAuthenticationPolicyBody } from '@cadenway/contracts/validators/public/organizations';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Body, Controller, Get, Inject, Patch, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import {
  relaySessionUpstream,
  relayUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import type { AuthenticationPolicyChanges } from '../../../../application/models/authentication-policies/authentication-policy-changes.model.js';
import { UpdateAuthenticationPolicy } from '../../../../application/use-cases/commands/authentication-policies/update-authentication-policy/update-authentication-policy.use-case.js';
import { GetAuthenticationPolicy } from '../../../../application/use-cases/queries/authentication-policies/get-authentication-policy/get-authentication-policy.use-case.js';
import { toAuthenticationPolicy } from '../../mappers/authentication-policies/authentication-policy.mapper.js';

/**
 * Constant ROLE_FORBIDDEN
 *
 * @description
 * The `403` of a member or a guest: only the owner and the admins read and change the policy,
 * which identity-service decides from its copy of the memberships.
 *
 * @type {string}
 */
const ROLE_FORBIDDEN: string = 'organization.role-forbidden';

/**
 * Constant ORGANIZATION_NOT_FOUND
 *
 * @description
 * The `404` of an organization identity-service does not hold the caller as a member of, also for
 * a few seconds after a creation or an acceptance.
 *
 * @type {readonly string[]}
 */
const ORGANIZATION_NOT_FOUND: readonly string[] = ['organization.not-found'];

/**
 * Constant READ_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `GET /v1/organization/authentication-policy` answers as
 * they are.
 *
 * @type {AcceptedProblems}
 */
const READ_PROBLEMS: AcceptedProblems = {
  403: [ROLE_FORBIDDEN],
  404: ORGANIZATION_NOT_FOUND,
};

/**
 * Constant UPDATE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `PATCH /v1/organization/authentication-policy` answers as
 * they are, in the order identity-service checks them: the role, `If-Match`, the two-step
 * verification of the caller when the patch requires it of a role they have
 * (`409 auth.two-step-not-enabled`), then the recent authentication of the session
 * (`403 auth.reauthentication-required`, `details.methods`).
 *
 * @type {AcceptedProblems}
 */
const UPDATE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: [ROLE_FORBIDDEN, 'auth.reauthentication-required'],
  404: ORGANIZATION_NOT_FOUND,
  409: ['auth.two-step-not-enabled'],
  412: ['request.version-mismatch'],
};

/**
 * Constant ENDED_SESSION
 *
 * @description
 * The internal `404` code of the change that means the session of the request ended after its
 * introspection: `401 auth.session-expired`.
 *
 * @type {readonly string[]}
 */
const ENDED_SESSION: readonly string[] = ['session.not-found'];

/**
 * Function toChanges
 *
 * @description
 * Maps the public JSON Merge Patch of the policy to its changes, member by member: a member left
 * out stays out.
 *
 * @param {z.output<typeof UpdateAuthenticationPolicyBody>} body - The validated patch.
 * @returns {AuthenticationPolicyChanges} The changes.
 */
function toChanges(
  body: z.output<typeof UpdateAuthenticationPolicyBody>,
): AuthenticationPolicyChanges {
  return {
    ...(body.twoStepVerificationRequiredFor === undefined
      ? {}
      : { twoStepVerificationRequiredFor: body.twoStepVerificationRequiredFor }),
    ...(body.sessionInactivityTimeoutMinutes === undefined
      ? {}
      : { sessionInactivityTimeoutMinutes: body.sessionInactivityTimeoutMinutes }),
  };
}

/**
 * Class AuthenticationPolicyController
 *
 * @description
 * The routes of the tag `authentication-policy` of `openapi/public/organizations.yaml`: read and
 * change the authentication policy of the current organization, which identity-service keeps and
 * applies (decision D5). Session only: `CredentialGuard` answers a personal API token
 * `403 auth.api-token-not-accepted`, a session whose current organization is withheld for want of
 * two-step verification `403 organization.mfa-required`, and one without a current organization
 * `403 organization.not-selected`, before any call. The organization of the call is the one of the
 * internal token, from the introspection; identity-service decides the role rule. The answers
 * carry the `ETag` of the version of the policy; `If-Match` is relayed unchanged.
 */
@Controller('v1/organization/authentication-policy')
@UseGuards(CredentialGuard, RateLimitGuard)
export class AuthenticationPolicyController {
  // #region Properties
  /**
   * Property reading
   *
   * @description
   * Reads the policy.
   *
   * @type {GetAuthenticationPolicy}
   * @readonly
   */
  private readonly reading: GetAuthenticationPolicy;

  /**
   * Property updating
   *
   * @description
   * Changes the policy.
   *
   * @type {UpdateAuthenticationPolicy}
   * @readonly
   */
  private readonly updating: UpdateAuthenticationPolicy;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the policy routes.
   *
   * @param {GetAuthenticationPolicy} reading - Reads the policy.
   * @param {UpdateAuthenticationPolicy} updating - Changes the policy.
   * @constructor
   */
  public constructor(
    @Inject(GetAuthenticationPolicy) reading: GetAuthenticationPolicy,
    @Inject(UpdateAuthenticationPolicy) updating: UpdateAuthenticationPolicy,
  ) {
    this.reading = reading;
    this.updating = updating;
  }
  // #endregion

  // #region Methods
  /**
   * Method getAuthenticationPolicy
   *
   * @description
   * `GET /v1/organization/authentication-policy`: the policy of the current organization, with its
   * `ETag`. Owner and admins only.
   *
   * @param {Response} response - Response of the request.
   * @returns {Promise<AuthenticationPolicy>} The policy.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'getAuthenticationPolicy',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getAuthenticationPolicy(
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationPolicy> {
    return toAuthenticationPolicy(
      await relayUpstream(response, READ_PROBLEMS, () => this.reading.execute()),
    );
  }

  /**
   * Method updateAuthenticationPolicy
   *
   * @description
   * `PATCH /v1/organization/authentication-policy`: a JSON Merge Patch of the policy of the
   * current organization, with the session of the request, whose recent authentication
   * identity-service checks, and `If-Match` relayed unchanged. A session that ended since its
   * introspection (`404 session.not-found`) is `401 auth.session-expired`.
   *
   * @param {z.output<typeof UpdateAuthenticationPolicyBody>} body - The patch.
   * @param {string | undefined} ifMatch - `If-Match` of the request.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response of the request.
   * @returns {Promise<AuthenticationPolicy>} The policy after the change.
   * @throws {Error} When the request carries no verified session: the guard did not run.
   */
  @Patch()
  @CredentialGuard.requires({
    operationId: 'updateAuthenticationPolicy',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateAuthenticationPolicy(
    @Body(new ZodValidationPipe(UpdateAuthenticationPolicyBody))
    body: z.output<typeof UpdateAuthenticationPolicyBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationPolicy> {
    const session: RequestSession | undefined = verifiedSessionOf(request);
    if (session === undefined) {
      throw new Error('PATCH /v1/organization/authentication-policy ran without a session.');
    }
    return toAuthenticationPolicy(
      await relaySessionUpstream(
        response,
        UPDATE_PROBLEMS,
        () =>
          this.updating.execute({
            sessionId: session.sessionId,
            changes: toChanges(body),
            ifMatch,
          }),
        ENDED_SESSION,
      ),
    );
  }
  // #endregion
}
