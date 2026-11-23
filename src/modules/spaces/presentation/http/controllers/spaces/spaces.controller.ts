import {
  CreateSpaceBody,
  CreateSpaceHeader,
  CreateSpaceResponse,
  DeleteSpaceParams,
  GetSpaceOverviewParams,
  GetSpaceOverviewQueryParams,
  GetSpaceOverviewResponse,
  GetSpaceParams,
  GetSpaceResponse,
  ListSpacesQueryParams,
  ListSpacesResponse,
  UpdateSpaceBody,
  UpdateSpaceParams,
  UpdateSpaceResponse,
} from '@cadenway/contracts/validators/public/spaces';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
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
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListSpaces } from '../../../../application/use-cases/queries/spaces/list-spaces/list-spaces.use-case.js';
import { CreateSpace } from '../../../../application/use-cases/commands/spaces/create-space/create-space.use-case.js';
import { GetSpace } from '../../../../application/use-cases/queries/spaces/get-space/get-space.use-case.js';
import { UpdateSpace } from '../../../../application/use-cases/commands/spaces/update-space/update-space.use-case.js';
import { DeleteSpace } from '../../../../application/use-cases/commands/spaces/delete-space/delete-space.use-case.js';
import { GetSpaceOverview } from '../../../../application/use-cases/queries/spaces/get-space-overview/get-space-overview.use-case.js';

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
 * Constant LIST_SPACES_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/spaces` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_SPACES_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Constant CREATE_SPACE_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/spaces` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const CREATE_SPACE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['organization.not-found'],
  409: ['space.prefix-taken', 'idempotency.request-in-progress'],
  422: ['idempotency.key-reused'],
};

/**
 * Constant GET_SPACE_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/spaces/{spaceId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_SPACE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};

/**
 * Constant UPDATE_SPACE_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PATCH /v1/spaces/{spaceId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const UPDATE_SPACE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['space.visibility-forbidden', 'access.role-insufficient'],
  404: ['space.not-found', 'organization.not-found'],
  409: ['space.prefix-taken'],
  412: ['request.version-mismatch'],
  422: ['space.status-required'],
};

/**
 * Constant DELETE_SPACE_PROBLEMS
 *
 * @description
 * Client errors of task-service that `DELETE /v1/spaces/{spaceId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const DELETE_SPACE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['space.manage-forbidden'],
  404: ['space.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
};

/**
 * Constant GET_SPACE_OVERVIEW_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/spaces/{spaceId}/overview` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_SPACE_OVERVIEW_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};

/**
 * Class SpacesController
 *
 * @description
 * The space routes of `openapi/public/spaces.yaml`: list, create, read, change and delete the spaces of the current organization, and the overview of one.
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (reads) or
 * `tasks:write` (writes, spaces and lists included), on the current organization:
 * `CredentialGuard` answers `403 auth.scope-missing`, `403 organization.not-selected` and
 * `403 organization.mfa-required` before any call, and `RateLimitGuard` counts the credential.
 * task-service decides everything; the gateway relays the client errors each public operation
 * declares, with their French titles, and maps every answer to the public contract through its
 * public validator.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class SpacesController {
  // #region Properties
  /**
   * Property spaceListing
   *
   * @description
   * Use case `ListSpaces`.
   *
   * @type {ListSpaces}
   * @readonly
   */
  private readonly spaceListing: ListSpaces;

  /**
   * Property spaceCreation
   *
   * @description
   * Use case `CreateSpace`.
   *
   * @type {CreateSpace}
   * @readonly
   */
  private readonly spaceCreation: CreateSpace;

  /**
   * Property spaceReading
   *
   * @description
   * Use case `GetSpace`.
   *
   * @type {GetSpace}
   * @readonly
   */
  private readonly spaceReading: GetSpace;

  /**
   * Property spaceChange
   *
   * @description
   * Use case `UpdateSpace`.
   *
   * @type {UpdateSpace}
   * @readonly
   */
  private readonly spaceChange: UpdateSpace;

  /**
   * Property spaceDeletion
   *
   * @description
   * Use case `DeleteSpace`.
   *
   * @type {DeleteSpace}
   * @readonly
   */
  private readonly spaceDeletion: DeleteSpace;

  /**
   * Property overviewReading
   *
   * @description
   * Use case `GetSpaceOverview`.
   *
   * @type {GetSpaceOverview}
   * @readonly
   */
  private readonly overviewReading: GetSpaceOverview;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {ListSpaces} spaceListing - Use case `ListSpaces`.
   * @param {CreateSpace} spaceCreation - Use case `CreateSpace`.
   * @param {GetSpace} spaceReading - Use case `GetSpace`.
   * @param {UpdateSpace} spaceChange - Use case `UpdateSpace`.
   * @param {DeleteSpace} spaceDeletion - Use case `DeleteSpace`.
   * @param {GetSpaceOverview} overviewReading - Use case `GetSpaceOverview`.
   * @constructor
   */
  public constructor(
    @Inject(ListSpaces) spaceListing: ListSpaces,
    @Inject(CreateSpace) spaceCreation: CreateSpace,
    @Inject(GetSpace) spaceReading: GetSpace,
    @Inject(UpdateSpace) spaceChange: UpdateSpace,
    @Inject(DeleteSpace) spaceDeletion: DeleteSpace,
    @Inject(GetSpaceOverview) overviewReading: GetSpaceOverview,
  ) {
    this.spaceListing = spaceListing;
    this.spaceCreation = spaceCreation;
    this.spaceReading = spaceReading;
    this.spaceChange = spaceChange;
    this.spaceDeletion = spaceDeletion;
    this.overviewReading = overviewReading;
  }
  // #endregion

  // #region Methods
  /**
   * Method listSpaces
   *
   * @description
   * `GET /v1/spaces`: one page of the spaces the caller sees, in the order of their creation.
   *
   * @param {z.output<typeof ListSpacesQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListSpacesResponse>>} The answer, mapped to the public contract.
   */
  @Get('spaces')
  @CredentialGuard.requires({
    operationId: 'listSpaces',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listSpaces(
    @Query(new ZodValidationPipe(ListSpacesQueryParams))
    query: z.output<typeof ListSpacesQueryParams>,
  ): Promise<z.output<typeof ListSpacesResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listSpaces',
      ListSpacesResponse,
      await relayProblems(LIST_SPACES_PROBLEMS, () => this.spaceListing.execute(query)),
    );
  }

  /**
   * Method createSpace
   *
   * @description
   * `POST /v1/spaces`: creates a space and its first list. `201` with `Location: /v1/spaces/<spaceId>` and the `ETag` of the space; `Idempotency-Key` is relayed unchanged.
   *
   * @param {z.output<typeof CreateSpaceBody>} body - The body, validated.
   * @param {string | undefined} idempotencyKeyHeader - `Idempotency-Key` of the request.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<z.output<typeof CreateSpaceResponse>>} The answer, mapped to the public contract.
   */
  @Post('spaces')
  @CredentialGuard.requires({
    operationId: 'createSpace',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async createSpace(
    @RequiredBody(CreateSpaceBody) body: z.output<typeof CreateSpaceBody>,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateSpaceResponse>> {
    const idempotencyKey: string | undefined = toRequestHeader(
      'Idempotency-Key',
      CreateSpaceHeader.shape['Idempotency-Key'],
      idempotencyKeyHeader,
    );
    const created: z.output<typeof CreateSpaceResponse> = conformBody(
      TASK_SERVICE,
      'createSpace',
      CreateSpaceResponse,
      await relayProblems(CREATE_SPACE_PROBLEMS, () =>
        this.spaceCreation.execute(body, idempotencyKey),
      ),
    );
    response.setHeader('Location', `/v1/spaces/${created.space.id}`);
    response.setHeader('ETag', formatEtag(created.space.version));
    return created;
  }

  /**
   * Method getSpace
   *
   * @description
   * `GET /v1/spaces/{spaceId}`: one space, with its `ETag`.
   *
   * @param {z.output<typeof GetSpaceParams>} params - The path parameters.
   * @returns {Promise<z.output<typeof GetSpaceResponse>>} The answer, mapped to the public contract.
   */
  @Get('spaces/:spaceId')
  @CredentialGuard.requires({
    operationId: 'getSpace',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getSpace(
    @Param(new ZodValidationPipe(GetSpaceParams)) params: z.output<typeof GetSpaceParams>,
  ): Promise<z.output<typeof GetSpaceResponse>> {
    return conformBody(
      TASK_SERVICE,
      'getSpace',
      GetSpaceResponse,
      await relayProblems(GET_SPACE_PROBLEMS, () => this.spaceReading.execute(params.spaceId)),
    );
  }

  /**
   * Method updateSpace
   *
   * @description
   * `PATCH /v1/spaces/{spaceId}`: changes a space (JSON Merge Patch), with `If-Match` relayed unchanged.
   *
   * @param {z.output<typeof UpdateSpaceParams>} params - The path parameters.
   * @param {z.output<typeof UpdateSpaceBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof UpdateSpaceResponse>>} The answer, mapped to the public contract.
   */
  @Patch('spaces/:spaceId')
  @CredentialGuard.requires({
    operationId: 'updateSpace',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async updateSpace(
    @Param(new ZodValidationPipe(UpdateSpaceParams)) params: z.output<typeof UpdateSpaceParams>,
    @RequiredBody(UpdateSpaceBody) body: z.output<typeof UpdateSpaceBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateSpaceResponse>> {
    return conformBody(
      TASK_SERVICE,
      'updateSpace',
      UpdateSpaceResponse,
      await relayProblems(UPDATE_SPACE_PROBLEMS, () =>
        this.spaceChange.execute(params.spaceId, body, ifMatch),
      ),
    );
  }

  /**
   * Method deleteSpace
   *
   * @description
   * `DELETE /v1/spaces/{spaceId}`: deletes a space with its lists, `If-Match` relayed unchanged.
   * `204` without a body nor an `ETag`, as the contract declares; task-service moves its tasks to
   * the trash afterwards.
   *
   * @param {z.output<typeof DeleteSpaceParams>} params - The path parameters.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<void>} Resolves once the space is deleted.
   */
  @Delete('spaces/:spaceId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteSpace',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async deleteSpace(
    @Param(new ZodValidationPipe(DeleteSpaceParams)) params: z.output<typeof DeleteSpaceParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    await relayProblems(DELETE_SPACE_PROBLEMS, () =>
      this.spaceDeletion.execute(params.spaceId, ifMatch),
    );
  }

  /**
   * Method getSpaceOverview
   *
   * @description
   * `GET /v1/spaces/{spaceId}/overview`: the overview of a space, counted on the `today` of the caller, which is relayed.
   *
   * @param {z.output<typeof GetSpaceOverviewParams>} params - The path parameters.
   * @param {z.output<typeof GetSpaceOverviewQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof GetSpaceOverviewResponse>>} The answer, mapped to the public contract.
   */
  @Get('spaces/:spaceId/overview')
  @CredentialGuard.requires({
    operationId: 'getSpaceOverview',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async getSpaceOverview(
    @Param(new ZodValidationPipe(GetSpaceOverviewParams))
    params: z.output<typeof GetSpaceOverviewParams>,
    @Query(new ZodValidationPipe(GetSpaceOverviewQueryParams))
    query: z.output<typeof GetSpaceOverviewQueryParams>,
  ): Promise<z.output<typeof GetSpaceOverviewResponse>> {
    return conformBody(
      TASK_SERVICE,
      'getSpaceOverview',
      GetSpaceOverviewResponse,
      await relayProblems(GET_SPACE_OVERVIEW_PROBLEMS, () =>
        this.overviewReading.execute(params.spaceId, query),
      ),
    );
  }
  // #endregion
}
