import {
  CreateListBody,
  CreateListHeader,
  CreateListParams,
  CreateListResponse,
  DeleteListParams,
  GetListCountsParams,
  GetListCountsQueryParams,
  GetListCountsResponse,
  GetListParams,
  GetListResponse,
  ListListActivityParams,
  ListListActivityQueryParams,
  ListListActivityResponse,
  QueryListListActivityBody,
  ListListsParams,
  ListListsQueryParams,
  ListListsResponse,
  UpdateListBody,
  UpdateListParams,
  UpdateListResponse,
} from '@cadenway/contracts/validators/public/lists';
import { ZodValidationPipe } from '@cadenway/nest-common';
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
  QueryMethod,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toQueryList } from '../../../../../../presentation/http/mappers/query-parameters.mapper.js';
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { CreateList } from '../../../../application/use-cases/commands/lists/create-list/create-list.use-case.js';
import { ListLists } from '../../../../application/use-cases/queries/lists/list-lists/list-lists.use-case.js';
import { GetList } from '../../../../application/use-cases/queries/lists/get-list/get-list.use-case.js';
import { UpdateList } from '../../../../application/use-cases/commands/lists/update-list/update-list.use-case.js';
import { DeleteList } from '../../../../application/use-cases/commands/lists/delete-list/delete-list.use-case.js';
import { GetListCounts } from '../../../../application/use-cases/queries/lists/get-list-counts/get-list-counts.use-case.js';
import { ListListActivity } from '../../../../application/use-cases/queries/activity/list-list-activity/list-list-activity.use-case.js';

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
 * Constant CREATE_LIST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/spaces/{spaceId}/lists` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const CREATE_LIST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['space.not-found', 'organization.not-found'],
  409: ['idempotency.request-in-progress'],
  422: ['list.sprint-dates-invalid', 'idempotency.key-reused'],
};

/**
 * Constant LIST_LISTS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/spaces/{spaceId}/lists` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_LISTS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};

/**
 * Constant GET_LIST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/lists/{listId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_LIST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};

/**
 * Constant UPDATE_LIST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PATCH /v1/lists/{listId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const UPDATE_LIST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
  422: ['list.sprint-dates-invalid'],
};

/**
 * Constant DELETE_LIST_PROBLEMS
 *
 * @description
 * Client errors of task-service that `DELETE /v1/lists/{listId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const DELETE_LIST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
};

/**
 * Constant GET_LIST_COUNTS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/lists/{listId}/counts` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_LIST_COUNTS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};

/**
 * Constant LIST_LIST_ACTIVITY_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/lists/{listId}/activity` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_LIST_ACTIVITY_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};

/**
 * Constant LIST_LIST_ACTIVITY_QUERY
 *
 * @description
 * The query of `GET /v1/lists/{listId}/activity` as the contract validates it, with `kind`, `actorId` split on
 * their commas first (`style: form, explode: false`).
 *
 * @type {z.ZodType}
 */
const LIST_LIST_ACTIVITY_QUERY = ListListActivityQueryParams.extend({
  kind: z.preprocess(toQueryList, ListListActivityQueryParams.shape.kind),
  actorId: z.preprocess(toQueryList, ListListActivityQueryParams.shape.actorId),
});

/**
 * Class ListsController
 *
 * @description
 * The list and sprint routes of `openapi/public/lists.yaml`: create and list the lists of a space, read, change and delete a list, its counts and its activity.
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
export class ListsController {
  // #region Properties
  /**
   * Property listCreation
   *
   * @description
   * Use case `CreateList`.
   *
   * @type {CreateList}
   * @readonly
   */
  private readonly listCreation: CreateList;

  /**
   * Property listListing
   *
   * @description
   * Use case `ListLists`.
   *
   * @type {ListLists}
   * @readonly
   */
  private readonly listListing: ListLists;

  /**
   * Property listReading
   *
   * @description
   * Use case `GetList`.
   *
   * @type {GetList}
   * @readonly
   */
  private readonly listReading: GetList;

  /**
   * Property listChange
   *
   * @description
   * Use case `UpdateList`.
   *
   * @type {UpdateList}
   * @readonly
   */
  private readonly listChange: UpdateList;

  /**
   * Property listDeletion
   *
   * @description
   * Use case `DeleteList`.
   *
   * @type {DeleteList}
   * @readonly
   */
  private readonly listDeletion: DeleteList;

  /**
   * Property countsReading
   *
   * @description
   * Use case `GetListCounts`.
   *
   * @type {GetListCounts}
   * @readonly
   */
  private readonly countsReading: GetListCounts;

  /**
   * Property activityListing
   *
   * @description
   * Use case `ListListActivity`.
   *
   * @type {ListListActivity}
   * @readonly
   */
  private readonly activityListing: ListListActivity;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {CreateList} listCreation - Use case `CreateList`.
   * @param {ListLists} listListing - Use case `ListLists`.
   * @param {GetList} listReading - Use case `GetList`.
   * @param {UpdateList} listChange - Use case `UpdateList`.
   * @param {DeleteList} listDeletion - Use case `DeleteList`.
   * @param {GetListCounts} countsReading - Use case `GetListCounts`.
   * @param {ListListActivity} activityListing - Use case `ListListActivity`.
   * @constructor
   */
  public constructor(
    @Inject(CreateList) listCreation: CreateList,
    @Inject(ListLists) listListing: ListLists,
    @Inject(GetList) listReading: GetList,
    @Inject(UpdateList) listChange: UpdateList,
    @Inject(DeleteList) listDeletion: DeleteList,
    @Inject(GetListCounts) countsReading: GetListCounts,
    @Inject(ListListActivity) activityListing: ListListActivity,
  ) {
    this.listCreation = listCreation;
    this.listListing = listListing;
    this.listReading = listReading;
    this.listChange = listChange;
    this.listDeletion = listDeletion;
    this.countsReading = countsReading;
    this.activityListing = activityListing;
  }
  // #endregion

  // #region Methods
  /**
   * Method createList
   *
   * @description
   * `POST /v1/spaces/{spaceId}/lists`: creates a list or a sprint in a space. `201` with `Location: /v1/lists/<listId>` and its `ETag`; `Idempotency-Key` is relayed unchanged.
   *
   * @param {z.output<typeof CreateListParams>} params - The path parameters.
   * @param {z.output<typeof CreateListBody>} body - The body, validated.
   * @param {string | undefined} idempotencyKeyHeader - `Idempotency-Key` of the request.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<z.output<typeof CreateListResponse>>} The answer, mapped to the public contract.
   */
  @Post('spaces/:spaceId/lists')
  @CredentialGuard.requires({
    operationId: 'createList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async createList(
    @Param(new ZodValidationPipe(CreateListParams)) params: z.output<typeof CreateListParams>,
    @RequiredBody(CreateListBody) body: z.output<typeof CreateListBody>,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateListResponse>> {
    const idempotencyKey: string | undefined = toRequestHeader(
      'Idempotency-Key',
      CreateListHeader.shape['Idempotency-Key'],
      idempotencyKeyHeader,
    );
    const created: z.output<typeof CreateListResponse> = conformBody(
      TASK_SERVICE,
      'createList',
      CreateListResponse,
      await relayProblems(CREATE_LIST_PROBLEMS, () =>
        this.listCreation.execute(params.spaceId, body, idempotencyKey),
      ),
    );
    response.setHeader('Location', `/v1/lists/${created.id}`);
    return created;
  }

  /**
   * Method listLists
   *
   * @description
   * `GET /v1/spaces/{spaceId}/lists`: one page of the lists of a space.
   *
   * @param {z.output<typeof ListListsParams>} params - The path parameters.
   * @param {z.output<typeof ListListsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListListsResponse>>} The answer, mapped to the public contract.
   */
  @Get('spaces/:spaceId/lists')
  @CredentialGuard.requires({
    operationId: 'listLists',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listLists(
    @Param(new ZodValidationPipe(ListListsParams)) params: z.output<typeof ListListsParams>,
    @Query(new ZodValidationPipe(ListListsQueryParams))
    query: z.output<typeof ListListsQueryParams>,
  ): Promise<z.output<typeof ListListsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listLists',
      ListListsResponse,
      await relayProblems(LIST_LISTS_PROBLEMS, () =>
        this.listListing.execute(params.spaceId, query),
      ),
    );
  }

  /**
   * Method getList
   *
   * @description
   * `GET /v1/lists/{listId}`: one list, with its `ETag`.
   *
   * @param {z.output<typeof GetListParams>} params - The path parameters.
   * @returns {Promise<z.output<typeof GetListResponse>>} The answer, mapped to the public contract.
   */
  @Get('lists/:listId')
  @CredentialGuard.requires({
    operationId: 'getList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getList(
    @Param(new ZodValidationPipe(GetListParams)) params: z.output<typeof GetListParams>,
  ): Promise<z.output<typeof GetListResponse>> {
    return conformBody(
      TASK_SERVICE,
      'getList',
      GetListResponse,
      await relayProblems(GET_LIST_PROBLEMS, () => this.listReading.execute(params.listId)),
    );
  }

  /**
   * Method updateList
   *
   * @description
   * `PATCH /v1/lists/{listId}`: changes a list (JSON Merge Patch), with `If-Match` relayed unchanged.
   *
   * @param {z.output<typeof UpdateListParams>} params - The path parameters.
   * @param {z.output<typeof UpdateListBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof UpdateListResponse>>} The answer, mapped to the public contract.
   */
  @Patch('lists/:listId')
  @CredentialGuard.requires({
    operationId: 'updateList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateList(
    @Param(new ZodValidationPipe(UpdateListParams)) params: z.output<typeof UpdateListParams>,
    @RequiredBody(UpdateListBody) body: z.output<typeof UpdateListBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateListResponse>> {
    return conformBody(
      TASK_SERVICE,
      'updateList',
      UpdateListResponse,
      await relayProblems(UPDATE_LIST_PROBLEMS, () =>
        this.listChange.execute(params.listId, body, ifMatch),
      ),
    );
  }

  /**
   * Method deleteList
   *
   * @description
   * `DELETE /v1/lists/{listId}`: deletes a list or a sprint, archived or not, `If-Match` relayed
   * unchanged. `204` without a body nor an `ETag`, as the contract declares; task-service moves its
   * tasks to the trash afterwards.
   *
   * @param {z.output<typeof DeleteListParams>} params - The path parameters.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<void>} Resolves once the list is deleted.
   */
  @Delete('lists/:listId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async deleteList(
    @Param(new ZodValidationPipe(DeleteListParams)) params: z.output<typeof DeleteListParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    await relayProblems(DELETE_LIST_PROBLEMS, () =>
      this.listDeletion.execute(params.listId, ifMatch),
    );
  }

  /**
   * Method getListCounts
   *
   * @description
   * `GET /v1/lists/{listId}/counts`: the counts of a list, on the `today` of the caller, which is relayed.
   *
   * @param {z.output<typeof GetListCountsParams>} params - The path parameters.
   * @param {z.output<typeof GetListCountsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof GetListCountsResponse>>} The answer, mapped to the public contract.
   */
  @Get('lists/:listId/counts')
  @CredentialGuard.requires({
    operationId: 'getListCounts',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getListCounts(
    @Param(new ZodValidationPipe(GetListCountsParams)) params: z.output<typeof GetListCountsParams>,
    @Query(new ZodValidationPipe(GetListCountsQueryParams))
    query: z.output<typeof GetListCountsQueryParams>,
  ): Promise<z.output<typeof GetListCountsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'getListCounts',
      GetListCountsResponse,
      await relayProblems(GET_LIST_COUNTS_PROBLEMS, () =>
        this.countsReading.execute(params.listId, query),
      ),
    );
  }

  /**
   * Method listListActivity
   *
   * @description
   * `GET /v1/lists/{listId}/activity`: one page of the activity of the tasks of a list.
   *
   * @param {z.output<typeof ListListActivityParams>} params - The path parameters.
   * @param {z.output<typeof LIST_LIST_ACTIVITY_QUERY>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListListActivityResponse>>} The answer, mapped to the public contract.
   */
  @Get('lists/:listId/activity')
  @CredentialGuard.requires({
    operationId: 'listListActivity',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listListActivity(
    @Param(new ZodValidationPipe(ListListActivityParams))
    params: z.output<typeof ListListActivityParams>,
    @Query(new ZodValidationPipe(LIST_LIST_ACTIVITY_QUERY))
    query: z.output<typeof LIST_LIST_ACTIVITY_QUERY>,
  ): Promise<z.output<typeof ListListActivityResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listListActivity',
      ListListActivityResponse,
      await relayProblems(LIST_LIST_ACTIVITY_PROBLEMS, () =>
        this.activityListing.execute(params.listId, query),
      ),
    );
  }

  /** Lists activity using filters supplied in a JSON body. */
  @QueryMethod('lists/:listId/activity')
  @CredentialGuard.requires({
    operationId: 'queryListListActivity',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async queryListListActivity(
    @Param(new ZodValidationPipe(ListListActivityParams))
    params: z.output<typeof ListListActivityParams>,
    @RequiredBody(QueryListListActivityBody) body: z.output<typeof QueryListListActivityBody>,
  ): Promise<z.output<typeof ListListActivityResponse>> {
    return conformBody(
      TASK_SERVICE,
      'queryListListActivity',
      ListListActivityResponse,
      await relayProblems(LIST_LIST_ACTIVITY_PROBLEMS, () =>
        this.activityListing.execute(params.listId, body, 'QUERY'),
      ),
    );
  }
  // #endregion
}
