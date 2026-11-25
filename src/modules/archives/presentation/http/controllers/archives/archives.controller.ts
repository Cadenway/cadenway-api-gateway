import {
  ArchiveListBody,
  ArchiveListParams,
  ArchiveListResponse,
  ArchiveTaskBody,
  ArchiveTaskParams,
  ArchiveTaskResponse,
  ListArchivedListsQueryParams,
  ListArchivedListsResponse,
  ListArchivedTasksQueryParams,
  ListArchivedTasksResponse,
  UnarchiveListBody,
  UnarchiveListParams,
  UnarchiveListResponse,
  UnarchiveTaskBody,
  UnarchiveTaskParams,
  UnarchiveTaskResponse,
} from '@cadenway/contracts/validators/public/archives';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ArchiveList } from '../../../../application/use-cases/commands/lists/archive-list/archive-list.use-case.js';
import { UnarchiveList } from '../../../../application/use-cases/commands/lists/unarchive-list/unarchive-list.use-case.js';
import { ArchiveTask } from '../../../../application/use-cases/commands/tasks/archive-task/archive-task.use-case.js';
import { UnarchiveTask } from '../../../../application/use-cases/commands/tasks/unarchive-task/unarchive-task.use-case.js';
import { ListArchivedLists } from '../../../../application/use-cases/queries/archives/list-archived-lists/list-archived-lists.use-case.js';
import { ListArchivedTasks } from '../../../../application/use-cases/queries/archives/list-archived-tasks/list-archived-tasks.use-case.js';

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
 * Constant LIST_ARCHIVING_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/lists/{listId}/archive` and
 * `POST /v1/lists/{listId}/unarchive` answer as they are: the codes both public operations
 * declare (`BadRequest`, `TasksWriteForbidden`, `ListNotFound`, `VersionMismatch`). Any other is
 * `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_ARCHIVING_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
};

/**
 * Constant TASK_ARCHIVING_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/tasks/{taskKey}/archive` and
 * `POST /v1/tasks/{taskKey}/unarchive` answer as they are: the codes both public operations
 * declare (`BadRequest`, `TasksWriteForbidden`, `TaskNotFound`, `VersionMismatch`), `task.trashed`
 * with its `details`. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const TASK_ARCHIVING_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  412: ['request.version-mismatch'],
};

/**
 * Constant ARCHIVES_LISTING_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/archives/lists` and `GET /v1/archives/tasks`
 * answer as they are: the codes both public operations declare. Any other is
 * `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const ARCHIVES_LISTING_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Constant ARCHIVE_LIST_BODY
 *
 * @description
 * Validator of the body of `POST /v1/lists/{listId}/archive`: an empty object, with no other
 * member (`additionalProperties: false` of `EmptyRequest`, which the generated validator does not
 * enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const ARCHIVE_LIST_BODY: z.ZodType<Record<string, never>> = ArchiveListBody.strict();

/**
 * Constant UNARCHIVE_LIST_BODY
 *
 * @description
 * Validator of the body of `POST /v1/lists/{listId}/unarchive`: the empty object of
 * `EmptyRequest`, with no other member.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const UNARCHIVE_LIST_BODY: z.ZodType<Record<string, never>> = UnarchiveListBody.strict();

/**
 * Constant ARCHIVE_TASK_BODY
 *
 * @description
 * Validator of the body of `POST /v1/tasks/{taskKey}/archive`: the empty object of
 * `EmptyRequest`, with no other member.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const ARCHIVE_TASK_BODY: z.ZodType<Record<string, never>> = ArchiveTaskBody.strict();

/**
 * Constant UNARCHIVE_TASK_BODY
 *
 * @description
 * Validator of the body of `POST /v1/tasks/{taskKey}/unarchive`: the empty object of
 * `EmptyRequest`, with no other member.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const UNARCHIVE_TASK_BODY: z.ZodType<Record<string, never>> = UnarchiveTaskBody.strict();

/**
 * Class ArchivesController
 *
 * @description
 * The routes of `openapi/public/archives.yaml`: archive and restore a list or a task, and list
 * the archived lists and tasks of the page "Archives".
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (the two
 * listings) or `tasks:write` (the four actions), on the current organization: `CredentialGuard`
 * answers `403 auth.scope-missing`, `403 organization.not-selected` and
 * `403 organization.mfa-required` before any call, and `RateLimitGuard` counts the credential.
 * task-service decides everything, who may archive (`edit` on the list) included; the gateway
 * relays the client errors each public operation declares, with their French titles, and maps
 * every answer to the public contract through its public validator. The `ETag` of an action is the
 * `version` of the list or task it answers, set by the `EtagInterceptor` of the kit.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ArchivesController {
  // #region Properties
  /**
   * Property listArchiving
   *
   * @description
   * Use case `ArchiveList`.
   *
   * @type {ArchiveList}
   * @readonly
   */
  private readonly listArchiving: ArchiveList;

  /**
   * Property listRestoration
   *
   * @description
   * Use case `UnarchiveList`.
   *
   * @type {UnarchiveList}
   * @readonly
   */
  private readonly listRestoration: UnarchiveList;

  /**
   * Property taskArchiving
   *
   * @description
   * Use case `ArchiveTask`.
   *
   * @type {ArchiveTask}
   * @readonly
   */
  private readonly taskArchiving: ArchiveTask;

  /**
   * Property taskRestoration
   *
   * @description
   * Use case `UnarchiveTask`.
   *
   * @type {UnarchiveTask}
   * @readonly
   */
  private readonly taskRestoration: UnarchiveTask;

  /**
   * Property archivedListListing
   *
   * @description
   * Use case `ListArchivedLists`.
   *
   * @type {ListArchivedLists}
   * @readonly
   */
  private readonly archivedListListing: ListArchivedLists;

  /**
   * Property archivedTaskListing
   *
   * @description
   * Use case `ListArchivedTasks`.
   *
   * @type {ListArchivedTasks}
   * @readonly
   */
  private readonly archivedTaskListing: ListArchivedTasks;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {ArchiveList} listArchiving - Use case `ArchiveList`.
   * @param {UnarchiveList} listRestoration - Use case `UnarchiveList`.
   * @param {ArchiveTask} taskArchiving - Use case `ArchiveTask`.
   * @param {UnarchiveTask} taskRestoration - Use case `UnarchiveTask`.
   * @param {ListArchivedLists} archivedListListing - Use case `ListArchivedLists`.
   * @param {ListArchivedTasks} archivedTaskListing - Use case `ListArchivedTasks`.
   * @constructor
   */
  public constructor(
    @Inject(ArchiveList) listArchiving: ArchiveList,
    @Inject(UnarchiveList) listRestoration: UnarchiveList,
    @Inject(ArchiveTask) taskArchiving: ArchiveTask,
    @Inject(UnarchiveTask) taskRestoration: UnarchiveTask,
    @Inject(ListArchivedLists) archivedListListing: ListArchivedLists,
    @Inject(ListArchivedTasks) archivedTaskListing: ListArchivedTasks,
  ) {
    this.listArchiving = listArchiving;
    this.listRestoration = listRestoration;
    this.taskArchiving = taskArchiving;
    this.taskRestoration = taskRestoration;
    this.archivedListListing = archivedListListing;
    this.archivedTaskListing = archivedTaskListing;
  }
  // #endregion

  // #region Methods
  /**
   * Method archiveList
   *
   * @description
   * `POST /v1/lists/{listId}/archive`: archives a list or a sprint, with `If-Match` relayed
   * unchanged. `200` with the list, `archivedAt` set, and its `ETag`.
   *
   * @param {z.output<typeof ArchiveListParams>} params - The path parameters.
   * @param {Record<string, never>} body - The empty body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, never blank.
   * @returns {Promise<z.output<typeof ArchiveListResponse>>} The answer, mapped to the public contract.
   */
  @Post('lists/:listId/archive')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'archiveList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async archiveList(
    @Param(new ZodValidationPipe(ArchiveListParams)) params: z.output<typeof ArchiveListParams>,
    @RequiredBody(ARCHIVE_LIST_BODY) body: Record<string, never>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof ArchiveListResponse>> {
    return conformBody(
      TASK_SERVICE,
      'archiveList',
      ArchiveListResponse,
      await relayProblems(LIST_ARCHIVING_PROBLEMS, () =>
        this.listArchiving.execute(params.listId, body, ifMatch),
      ),
    );
  }

  /**
   * Method unarchiveList
   *
   * @description
   * `POST /v1/lists/{listId}/unarchive`: restores an archived list at the end of its space, with
   * `If-Match` relayed unchanged. `200` with the list, `archivedAt` back to `null`, and its `ETag`.
   *
   * @param {z.output<typeof UnarchiveListParams>} params - The path parameters.
   * @param {Record<string, never>} body - The empty body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, never blank.
   * @returns {Promise<z.output<typeof UnarchiveListResponse>>} The answer, mapped to the public contract.
   */
  @Post('lists/:listId/unarchive')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'unarchiveList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async unarchiveList(
    @Param(new ZodValidationPipe(UnarchiveListParams)) params: z.output<typeof UnarchiveListParams>,
    @RequiredBody(UNARCHIVE_LIST_BODY) body: Record<string, never>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof UnarchiveListResponse>> {
    return conformBody(
      TASK_SERVICE,
      'unarchiveList',
      UnarchiveListResponse,
      await relayProblems(LIST_ARCHIVING_PROBLEMS, () =>
        this.listRestoration.execute(params.listId, body, ifMatch),
      ),
    );
  }

  /**
   * Method archiveTask
   *
   * @description
   * `POST /v1/tasks/{taskKey}/archive`: archives a task and its subtasks at every level, with
   * `If-Match` relayed unchanged. `200` with the task, `archivedAt` set, and its `ETag`; a task in
   * the trash answers `404 task.trashed` with its `details`.
   *
   * @param {z.output<typeof ArchiveTaskParams>} params - The path parameters.
   * @param {Record<string, never>} body - The empty body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, never blank.
   * @returns {Promise<z.output<typeof ArchiveTaskResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/archive')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'archiveTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async archiveTask(
    @Param(new ZodValidationPipe(ArchiveTaskParams)) params: z.output<typeof ArchiveTaskParams>,
    @RequiredBody(ARCHIVE_TASK_BODY) body: Record<string, never>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof ArchiveTaskResponse>> {
    return conformBody(
      TASK_SERVICE,
      'archiveTask',
      ArchiveTaskResponse,
      await relayProblems(TASK_ARCHIVING_PROBLEMS, () =>
        this.taskArchiving.execute(params.taskKey, body, ifMatch),
      ),
    );
  }

  /**
   * Method unarchiveTask
   *
   * @description
   * `POST /v1/tasks/{taskKey}/unarchive`: restores the archive a task belongs to, from its root,
   * with `If-Match` relayed unchanged. `200` with the root, `archivedAt` back to `null`, and its
   * `ETag`.
   *
   * @param {z.output<typeof UnarchiveTaskParams>} params - The path parameters.
   * @param {Record<string, never>} body - The empty body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, never blank.
   * @returns {Promise<z.output<typeof UnarchiveTaskResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/unarchive')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'unarchiveTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async unarchiveTask(
    @Param(new ZodValidationPipe(UnarchiveTaskParams)) params: z.output<typeof UnarchiveTaskParams>,
    @RequiredBody(UNARCHIVE_TASK_BODY) body: Record<string, never>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof UnarchiveTaskResponse>> {
    return conformBody(
      TASK_SERVICE,
      'unarchiveTask',
      UnarchiveTaskResponse,
      await relayProblems(TASK_ARCHIVING_PROBLEMS, () =>
        this.taskRestoration.execute(params.taskKey, body, ifMatch),
      ),
    );
  }

  /**
   * Method listArchivedLists
   *
   * @description
   * `GET /v1/archives/lists`: one page of the archived lists and sprints the caller sees, the
   * most recently archived first, with `total`.
   *
   * @param {z.output<typeof ListArchivedListsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListArchivedListsResponse>>} The answer, mapped to the public contract.
   */
  @Get('archives/lists')
  @CredentialGuard.requires({
    operationId: 'listArchivedLists',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listArchivedLists(
    @Query(new ZodValidationPipe(ListArchivedListsQueryParams))
    query: z.output<typeof ListArchivedListsQueryParams>,
  ): Promise<z.output<typeof ListArchivedListsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listArchivedLists',
      ListArchivedListsResponse,
      await relayProblems(ARCHIVES_LISTING_PROBLEMS, () => this.archivedListListing.execute(query)),
    );
  }

  /**
   * Method listArchivedTasks
   *
   * @description
   * `GET /v1/archives/tasks`: one page of the roots of the archived subtrees the caller sees, the
   * most recently archived first, with `total`.
   *
   * @param {z.output<typeof ListArchivedTasksQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListArchivedTasksResponse>>} The answer, mapped to the public contract.
   */
  @Get('archives/tasks')
  @CredentialGuard.requires({
    operationId: 'listArchivedTasks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listArchivedTasks(
    @Query(new ZodValidationPipe(ListArchivedTasksQueryParams))
    query: z.output<typeof ListArchivedTasksQueryParams>,
  ): Promise<z.output<typeof ListArchivedTasksResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listArchivedTasks',
      ListArchivedTasksResponse,
      await relayProblems(ARCHIVES_LISTING_PROBLEMS, () => this.archivedTaskListing.execute(query)),
    );
  }
  // #endregion
}
