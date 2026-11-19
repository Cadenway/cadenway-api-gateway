import {
  ApproveAccessRequestBody,
  ApproveAccessRequestParams,
  ApproveAccessRequestResponse,
  CreateAccessRequestBody,
  ListAccessRequestsQueryParams,
  ListAccessRequestsResponse,
  RefuseAccessRequestBody,
  RefuseAccessRequestParams,
  RefuseAccessRequestResponse,
} from '@cadenway/contracts/validators/public/access';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  relayUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ApproveAccessRequest } from '../../../../application/use-cases/commands/access-requests/approve-access-request/approve-access-request.use-case.js';
import { CreateAccessRequest } from '../../../../application/use-cases/commands/access-requests/create-access-request/create-access-request.use-case.js';
import { RefuseAccessRequest } from '../../../../application/use-cases/commands/access-requests/refuse-access-request/refuse-access-request.use-case.js';
import { ListAccessRequests } from '../../../../application/use-cases/queries/access-requests/list-access-requests/list-access-requests.use-case.js';

/**
 * Constant TASK_SERVICE
 *
 * @description
 * The service the routes of this controller relay, as `details.service` of the problem of an
 * answer the public contract cannot carry.
 *
 * @type {string}
 */
const TASK_SERVICE: string = 'task-service';

/**
 * Constant CREATE_ACCESS_REQUEST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/access-requests` answers as they are: the codes its
 * public operation declares, `429 access-request.limit-reached` with `details.nextAvailableAt`
 * included. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const CREATE_ACCESS_REQUEST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
  429: ['access-request.limit-reached'],
};

/**
 * Constant LIST_ACCESS_REQUESTS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/access-requests` answers as they are: the codes its
 * public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_ACCESS_REQUESTS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Constant APPROVE_ACCESS_REQUEST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/access-requests/{accessRequestId}/approval` answers
 * as they are: the codes its public operation declares, the refusals of a grant included. Any
 * other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const APPROVE_ACCESS_REQUEST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['access-request.not-found', 'organization.not-found'],
  409: ['access-request.already-decided'],
  422: [
    'access.grantee-invalid',
    'access.guest-space-forbidden',
    'access.owner-unchangeable',
    'access.grant-limit-reached',
  ],
};

/**
 * Constant REFUSE_ACCESS_REQUEST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/access-requests/{accessRequestId}/refusal` answers
 * as they are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const REFUSE_ACCESS_REQUEST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['access-request.not-found', 'organization.not-found'],
  409: ['access-request.already-decided'],
};

/**
 * Class AccessRequestsController
 *
 * @description
 * The access request routes of `openapi/public/access.yaml`: ask for access, list the pending
 * requests the caller may answer, approve one with a role or refuse it.
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (the list) or
 * `tasks:write` (the others), on the current organization: `CredentialGuard` answers
 * `403 auth.scope-missing`, `403 organization.not-selected` and `403 organization.mfa-required`
 * before any call, and `RateLimitGuard` counts the credential and answers
 * `429 rate-limit.exceeded` before any call. task-service decides whether a request is stored,
 * who answers it and the grant an approval gives; the gateway relays the client errors each
 * public operation declares, with their French titles, and maps every answer to the public
 * contract through its public validator.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class AccessRequestsController {
  // #region Properties
  /**
   * Property requestCreation
   *
   * @description
   * Use case `CreateAccessRequest`.
   *
   * @type {CreateAccessRequest}
   * @readonly
   */
  private readonly requestCreation: CreateAccessRequest;

  /**
   * Property requestListing
   *
   * @description
   * Use case `ListAccessRequests`.
   *
   * @type {ListAccessRequests}
   * @readonly
   */
  private readonly requestListing: ListAccessRequests;

  /**
   * Property requestApproval
   *
   * @description
   * Use case `ApproveAccessRequest`.
   *
   * @type {ApproveAccessRequest}
   * @readonly
   */
  private readonly requestApproval: ApproveAccessRequest;

  /**
   * Property requestRefusal
   *
   * @description
   * Use case `RefuseAccessRequest`.
   *
   * @type {RefuseAccessRequest}
   * @readonly
   */
  private readonly requestRefusal: RefuseAccessRequest;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {CreateAccessRequest} requestCreation - Use case `CreateAccessRequest`.
   * @param {ListAccessRequests} requestListing - Use case `ListAccessRequests`.
   * @param {ApproveAccessRequest} requestApproval - Use case `ApproveAccessRequest`.
   * @param {RefuseAccessRequest} requestRefusal - Use case `RefuseAccessRequest`.
   * @constructor
   */
  public constructor(
    @Inject(CreateAccessRequest) requestCreation: CreateAccessRequest,
    @Inject(ListAccessRequests) requestListing: ListAccessRequests,
    @Inject(ApproveAccessRequest) requestApproval: ApproveAccessRequest,
    @Inject(RefuseAccessRequest) requestRefusal: RefuseAccessRequest,
  ) {
    this.requestCreation = requestCreation;
    this.requestListing = requestListing;
    this.requestApproval = requestApproval;
    this.requestRefusal = requestRefusal;
  }
  // #endregion

  // #region Methods
  /**
   * Method createAccessRequest
   *
   * @description
   * `POST /v1/access-requests`: asks for access to a space, a list or a task. Always `202` with no
   * body, whether task-service stored the request or not; task-service answers
   * `400 request.invalid` for none or several targets. `429 access-request.limit-reached` is
   * relayed with `details.nextAvailableAt` and `Retry-After`, the whole seconds until then rounded
   * up and at least 1.
   *
   * @param {z.output<typeof CreateAccessRequestBody>} body - The body, validated.
   * @param {Response} response - Response, for `Retry-After`.
   * @returns {Promise<void>} Resolves once task-service took the request.
   */
  @Post('access-requests')
  @HttpCode(202)
  @CredentialGuard.requires({
    operationId: 'createAccessRequest',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async createAccessRequest(
    @Body(new ZodValidationPipe(CreateAccessRequestBody))
    body: z.output<typeof CreateAccessRequestBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await relayUpstream(response, CREATE_ACCESS_REQUEST_PROBLEMS, () =>
      this.requestCreation.execute(body),
    );
  }

  /**
   * Method listAccessRequests
   *
   * @description
   * `GET /v1/access-requests`: one page of the pending requests the caller may answer, filtered by
   * `spaceId` or `listId`.
   *
   * @param {z.output<typeof ListAccessRequestsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListAccessRequestsResponse>>} The answer, mapped to the public contract.
   */
  @Get('access-requests')
  @CredentialGuard.requires({
    operationId: 'listAccessRequests',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listAccessRequests(
    @Query(new ZodValidationPipe(ListAccessRequestsQueryParams))
    query: z.output<typeof ListAccessRequestsQueryParams>,
  ): Promise<z.output<typeof ListAccessRequestsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listAccessRequests',
      ListAccessRequestsResponse,
      await relayProblems(LIST_ACCESS_REQUESTS_PROBLEMS, () => this.requestListing.execute(query)),
    );
  }

  /**
   * Method approveAccessRequest
   *
   * @description
   * `POST /v1/access-requests/{accessRequestId}/approval`: approves a request with a role. `200`
   * with the request, `approved`.
   *
   * @param {z.output<typeof ApproveAccessRequestParams>} params - The path parameters.
   * @param {z.output<typeof ApproveAccessRequestBody>} body - The body, validated.
   * @returns {Promise<z.output<typeof ApproveAccessRequestResponse>>} The answer, mapped to the public contract.
   */
  @Post('access-requests/:accessRequestId/approval')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'approveAccessRequest',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async approveAccessRequest(
    @Param(new ZodValidationPipe(ApproveAccessRequestParams))
    params: z.output<typeof ApproveAccessRequestParams>,
    @Body(new ZodValidationPipe(ApproveAccessRequestBody))
    body: z.output<typeof ApproveAccessRequestBody>,
  ): Promise<z.output<typeof ApproveAccessRequestResponse>> {
    return conformBody(
      TASK_SERVICE,
      'approveAccessRequest',
      ApproveAccessRequestResponse,
      await relayProblems(APPROVE_ACCESS_REQUEST_PROBLEMS, () =>
        this.requestApproval.execute(params.accessRequestId, body),
      ),
    );
  }

  /**
   * Method refuseAccessRequest
   *
   * @description
   * `POST /v1/access-requests/{accessRequestId}/refusal`: refuses a request. `200` with the
   * request, `refused`.
   *
   * @param {z.output<typeof RefuseAccessRequestParams>} params - The path parameters.
   * @param {z.output<typeof RefuseAccessRequestBody>} body - The empty body, validated.
   * @returns {Promise<z.output<typeof RefuseAccessRequestResponse>>} The answer, mapped to the public contract.
   */
  @Post('access-requests/:accessRequestId/refusal')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'refuseAccessRequest',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async refuseAccessRequest(
    @Param(new ZodValidationPipe(RefuseAccessRequestParams))
    params: z.output<typeof RefuseAccessRequestParams>,
    @Body(new ZodValidationPipe(RefuseAccessRequestBody))
    body: z.output<typeof RefuseAccessRequestBody>,
  ): Promise<z.output<typeof RefuseAccessRequestResponse>> {
    return conformBody(
      TASK_SERVICE,
      'refuseAccessRequest',
      RefuseAccessRequestResponse,
      await relayProblems(REFUSE_ACCESS_REQUEST_PROBLEMS, () =>
        this.requestRefusal.execute(params.accessRequestId, body),
      ),
    );
  }
  // #endregion
}
